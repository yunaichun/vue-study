/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import { parseStyleText } from 'web/util/style'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'

/**
 * [transformNode 中置处理：预处理有 style 非绑定属性和 :style 绑定属性的标签]
 * @param  {[type]} el:      ASTElement      [当前元素对象]
 * @param  {[type]} options: CompilerOptions [基本配置项]
 * @return {[type]}          [description]
 */
function transformNode (el: ASTElement, options: CompilerOptions) {
  /*定义 warn 常量，它是一个函数，用来打印警告信息*/
  const warn = options.warn || baseWarn
  /*从元素描述对象上获取非绑定的 style 属性的值*/
  const staticStyle = getAndRemoveAttr(el, 'style')
  if (staticStyle) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      /* 在非生产环境下，并且非绑定的 style 属性值存在
         会使用 parseText 函数解析该值，如果解析成功则说明你在非绑定的 class 属性中使用了字面量表达式，例如：
         <div style="{{ color: red }}"></div>

         这时 Vue 会打印警告信息，提示你使用如下这种方式替代：
         <div :style="'color: red'"></div>
      */
      const expression = parseText(staticStyle, options.delimiters)
      if (expression) {
        warn(
          `style="${staticStyle}": ` +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div style="{{ val }}">, use <div :style="val">.'
        )
      }
    }
    /*与 class 属性不同，如果一个标签使用了非绑定的 style 属性，则会使用 parseStyleText 函数对属性值进行处理 
      1、<div style="color: red; background: green;"></div>
      2、el.staticStyle = JSON.stringify({
          color: 'red',
          background: 'green'
        })
    */
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
  }
  /*如果绑定的 style 属性的值存在，则将该值保存在 el.styleBinding 属性中 
    1、<div :style="{ fontSize: fontSize + 'px' }"></div>
    2、el.styleBinding = "{ fontSize: fontSize + 'px' }"
  */
  const styleBinding = getBindingAttr(el, 'style', false /* getStatic */)
  if (styleBinding) {
    el.styleBinding = styleBinding
  }
}

function genData (el: ASTElement): string {
  let data = ''
  if (el.staticStyle) {
    data += `staticStyle:${el.staticStyle},`
  }
  if (el.styleBinding) {
    data += `style:(${el.styleBinding}),`
  }
  return data
}

export default {
  staticKeys: ['staticStyle'],
  transformNode,
  genData
}
