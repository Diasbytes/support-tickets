/*
     .                              .o8                     oooo
   .o8                             "888                     `888
 .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
   888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
   888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
   888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
   "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 ========================================================================
 Created:    09/08/2018
 Author:     Chris Brame

 **/

var _               = require('lodash');
var path            = require('path');
var async           = require('async');
var nconf           = require('nconf');
var winston         = require('winston');
var elasticsearch   = require('elasticsearch');
var emitter         = require('../emitter');
var settingUtil     = require('../settings/settingsUtil');

var ES = {};

function checkConnection(callback) {
    if (!ES.esclient)
        return callback('Client not initialized');

    ES.esclient.ping({
        requestTimeout: 10000
    }, function(err) {
        if (err)
            return callback('Could not connect to Elasticsearch: ' + ES.host);

        return callback();
    });
}

ES.testConnection = function(callback) {
    if (process.env.ELATICSEARCH_URI)
        ES.host = process.env.ELATICSEARCH_URI;
    else
        ES.host = nconf.get('elasticsearch:host') + ':' + nconf.get('elasticsearch:port');

    ES.esclient = new elasticsearch.Client({
        host: ES.host
    });

    checkConnection(callback);
};

ES.setupHooks = function() {
    var ticketSchema = require('../models/ticket');
    emitter.on('ticket:deleted', function(data) {
       if (_.isUndefined(data._id))
           return false;

       ES.esclient.index({
           index: 'trudesk',
           type: 'ticket',
           id: data._id.toString(),
           refresh: 'true',
           body: {deleted: true}
       }, function (err) {
           if (err)
               winston.warn('Elasticsearch Error: ' + err);
       });
    });
    emitter.on('ticket:updated', function(data) {
        if (_.isUndefined(data._id))
            return;

        ticketSchema.getTicketById(data._id.toString(), function(err, ticket) {
            if (err) {
                winston.warn('Elasticsearch Error: ' + err);
                return false;
            }

            var cleanedTicket = {
                uid: ticket.uid,
                subject: ticket.subject,
                issue: ticket.issue,
                date: ticket.date,
                owner: ticket.owner,
                assignee: ticket.assignee,
                group: {
                    _id: ticket.group._id,
                    name: ticket.group.name
                },
                comments: ticket.comments,
                notes: ticket.notes,
                deleted: ticket.deleted,
                priority: ticket.priority,
                type: {
                    _id: ticket.type._id,
                    name: ticket.type.name
                },
                status: ticket.status,
                tags: ticket.tags
            };

            ES.esclient.index({
                index: 'trudesk',
                type: 'ticket',
                id: ticket._id.toString(),
                refresh: 'true',
                body: cleanedTicket
            }, function (err) {
                if (err)
                    winston.warn('Elasticsearch Error: ' + err);
            });
        });
    });

    emitter.on('ticket:created', function(data) {
        ticketSchema.getTicketById(data.ticket._id, function(err, ticket) {
            if (err) {
                winston.warn('Elasticsearch Error: ' + err);
                return false;
            }

            var _id = ticket._id.toString();
            var cleanedTicket = {
                uid: ticket.uid,
                subject: ticket.subject,
                issue: ticket.issue,
                date: ticket.date,
                owner: ticket.owner,
                assignee: ticket.assignee,
                group: {
                    _id: ticket.group._id,
                    name: ticket.group.name
                },
                comments: ticket.comments,
                notes: ticket.notes,
                deleted: ticket.deleted,
                priority: ticket.priority,
                type: {
                    _id: ticket.type._id,
                    name: ticket.type.name
                },
                status: ticket.status,
                tags: ticket.tags
            };

            ES.esclient.index({
                index: 'trudesk',
                type: 'ticket',
                id: _id,
                body: cleanedTicket
            }, function(err) {
                if (err)
                    winston.warn('Elasticsearch Error: ' + err);
            });
        });
    });
};

ES.rebuildIndex = function() {
    settingUtil.getSettings(function(err, settings) {
        if (err) {
            winston.warn(err);
            return false;
        }
        if (!settings.data.settings.elasticSearchConfigured.value)
            return false;

        var s = settings.data.settings;

        var ELASTICSEARCH_URI = s.elasticSearchHost.value + ':' + s.elasticSearchPort.value;

        global.esStatus = 'Rebuilding...';

        var fork = require('child_process').fork;
        var esFork = fork(path.join(__dirname, 'rebuildIndexChild.js'), { env: { FORK: 1, NODE_ENV: global.env, ELASTICSEARCH_URI: ELASTICSEARCH_URI, MONGODB_URI: global.CONNECTION_URI } } );

        global.forks.push({name: 'elasticsearchRebuild', fork: esFork});

        esFork.once('message', function(data) {
            global.esStatus = (data.success) ? 'Connected' : 'Error';
        });
    });
};

ES.getIndexCount = function(callback) {
    if (_.isUndefined(ES.esclient))
        return callback('Elasticsearch has not initialized');

    ES.esclient.count({
        index: 'trudesk'
    }, callback);
};

ES.init = function(callback) {
    global.esStatus = 'Not Configured';
    settingUtil.getSettings(function(err, s) {
        var settings = s.data.settings;

        var ENABLED = settings.elasticSearchConfigured;
        if (!ENABLED) {
            if (_.isFunction(callback))
                return callback();

            return false;
        }

        winston.debug('Initializing Elasticsearch...');
        global.esStatus = 'Initializing';

        ES.setupHooks();

        if (process.env.ELATICSEARCH_URI)
            ES.host = process.env.ELATICSEARCH_URI;
        else
            ES.host = settings.elasticSearchHost.value + ':' + settings.elasticSearchPort.value;

        ES.esclient = new elasticsearch.Client({
            host: ES.host
        });

        async.series([
            function(next) {
                checkConnection(function(err) {
                    if (err) return next(err);

                    winston.info('Elasticsearch Running... Connected.');
                    global.esStatus = 'Connected';
                    return next();
                });
            }
        ], function(err) {
            if (err)
                global.esStatus = 'Error';

            if (_.isFunction(callback))
                return callback(err);
        });
    });
};

module.exports = ES;