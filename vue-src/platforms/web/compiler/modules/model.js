/* @flow */

/**
 * Expand input[v-model] with dyanmic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */

import {
  getBindingAttr, /*获取动态绑定的属性值*/
  getAndRemoveAttr  /*获取给定元素的某个属性的值，并且删除元素对象attrsList中的该属性*/
} from 'compiler/helpers'

import {
  processFor, /*处理使用了v-for指令的元素*/
  processElement, /*其他一系列 process* 函数的集合*/
  addIfCondition, /*将有v-else-if或v-else指令的元素对象添加到v-if指令的元素对象的ifConnditions属性中*/
  createASTElement /*创建元素描述对象AST树*/
} from 'compiler/parser/index'

/**
 * [preTransformNode 前置处理：预处理使用了 v-model 属性并且使用了绑定的 type 属性的 input 标签]
 * @param  {[type]} el:      ASTElement      [当前元素对象]
 * @param  {[type]} options: CompilerOptions [基本配置项]
 * @return {[type]}          [description]
 */
function preTransformNode (el: ASTElement, options: CompilerOptions) {
  if (el.tag === 'input') {
    const map = el.attrsMap
    /*<input v-model="val" :type="inputType" />*/
    if (map['v-model'] && (map['v-bind:type'] || map[':type'])) {
      /*获取动态绑定的type*/
      const typeBinding: any = getBindingAttr(el, 'type')
      /*获取绑定的v-if*/
      const ifCondition = getAndRemoveAttr(el, 'v-if', true)
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
      /*一、克隆checkbox元素*/
      // 1. checkbox
      const branch0 = cloneASTElement(el)
      /*processOnce没有原因是：<input v-model="val" :type="inputType" v-once />，不存在静态的意义
        processIf没有原因是：条件指令早已经处理完了
      */
      // process for on the main node
      processFor(branch0)
      addRawAttr(branch0, 'type', 'checkbox')
      processElement(branch0, options)
      /*标识着当前元素描述对象已经被处理过了：目的是为了避免重复的解析*/
      branch0.processed = true // prevent it from double-processed
      /*为元素描述对象添加了 el.if 属性
        1、假设我们有如下模板：
            <input v-model="val" :type="inputType" v-if="display" />
        2、则 el.if 属性的值将为：'(${inputType})==='checkbox'&&display，
           可以看到只有当本地状态 inputType 的值为字符串 'checkbox' 并且本地状态 display 为真时才会渲染该复选按钮。
      */
      branch0.if = `type==='checkbox'` + ifConditionExtra
      /*如果一个标签使用了 v-if 指令，则该标签的元素描述对象被添加到其自身的 el.ifConditions 数组中*/
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. add radio else-if condition
      const branch1 = cloneASTElement(el)
      /*单纯的将克隆出来的元素描述对象中的 v-for 属性移除掉，因为在复选按钮中已经使用 processFor 处理过了 v-for 指令，
      由于它们本是互斥的，其本质上等价于是同一个元素，只是根据不同的条件渲染不同的标签罢了，
      所以 v-for 指令处理一次就够了。*/
      getAndRemoveAttr(branch1, 'v-for', true)
      addRawAttr(branch1, 'type', 'radio')
      processElement(branch1, options)
      addIfCondition(branch0, {
        exp: `type==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. other
      const branch2 = cloneASTElement(el)
      getAndRemoveAttr(branch2, 'v-for', true)
      addRawAttr(branch2, ':type', typeBinding)
      processElement(branch2, options)
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2
      })
      return branch0
    }
  }
}

/**
 * [cloneASTElement 克隆标签元素对象]
 * @param  {[type]} el [当前标签元素对象]
 * @return {[type]}    [description]
 */
function cloneASTElement (el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

/**
 * [addRawAttr 将属性的名和值分别添加到元素描述对象的 el.attrsMap 对象以及 el.attrsList 数组中]
 * @param {[type]} el    [当前标签元素对象]
 * @param {[type]} name  [属性名]
 * @param {[type]} value [属性值]
 */
function addRawAttr (el, name, value) {
  el.attrsMap[name] = value
  el.attrsList.push({ name, value })
}

export default {
  preTransformNode
}
