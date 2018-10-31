/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'

/**
 * [transformNode 中置处理：预处理有 class 非绑定属性和 :class 绑定属性的标签]
 * @param  {[type]} el:      ASTElement      [当前元素对象]
 * @param  {[type]} options: CompilerOptions [基本配置项]
 * @return {[type]}          [description]
 */
function transformNode (el: ASTElement, options: CompilerOptions) {
  /*定义 warn 常量，它是一个函数，用来打印警告信息*/
  const warn = options.warn || baseWarn
  /*从元素描述对象上获取非绑定的 class 属性的值*/
  const staticClass = getAndRemoveAttr(el, 'class')
  if (process.env.NODE_ENV !== 'production' && staticClass) {
    /* 在非生产环境下，并且非绑定的 class 属性值存在
       会使用 parseText 函数解析该值，如果解析成功则说明你在非绑定的 class 属性中使用了字面量表达式，例如：
       <div class="{{ isActive ? 'active' : '' }}"></div>

       这时 Vue 会打印警告信息，提示你使用如下这种方式替代：
       <div :class="{ 'active': isActive }"></div>
    */
    const expression = parseText(staticClass, options.delimiters)
    if (expression) {
      warn(
        `class="${staticClass}": ` +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.'
      )
    }
  }
  /*如果非绑定的 class 属性值存在，则将该值保存在元素描述对象的 el.staticClass 属性中 
    1、<div class="a b c"></div>
    2、el.staticClass = JSON.stringify('a b c')
  */
  if (staticClass) {
    el.staticClass = JSON.stringify(staticClass)
  }
  /*如果绑定的 class 属性的值存在，则将该值保存在 el.classBinding 属性中 
    1、<div :class="{ 'active': isActive }"></div>
    2、el.classBinding = "{ 'active': isActive }"
  */
  const classBinding = getBindingAttr(el, 'class', false /* getStatic */)
  if (classBinding) {
    el.classBinding = classBinding
  }
}

function genData (el: ASTElement): string {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  return data
}

export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
}
