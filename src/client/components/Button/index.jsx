/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    1/20/19 4:46 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import isUndefined from 'lodash/isUndefined'
import React from 'react'
import PropTypes from 'prop-types'

class Button extends React.Component {
  constructor (props) {
    super(props)
  }

  render () {
    const { small, flat, style, text, onClick, extraClass } = this.props
    const classBuild =
      (small ? ' md-btn-small ' : '') +
      (flat ? ' md-btn-flat ' : '') +
      (style && flat ? ' md-btn-flat-' + style : style ? ' md-btn-' + style : '') +
      ' ' +
      extraClass
    return (
      <button className={'md-btn' + classBuild} onClick={onClick}>
        {text}
      </button>
    )
  }
}

Button.propTypes = {
  text: PropTypes.string.isRequired,
  flat: PropTypes.bool,
  style: PropTypes.string,
  small: PropTypes.bool,
  extraClass: PropTypes.string,
  onClick: PropTypes.func
}

export default Button