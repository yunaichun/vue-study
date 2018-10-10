/* @flow */

import { parseFilters } from './parser/filter-parser'

export function baseWarn (msg: string) {
  console.error(`[Vue compiler]: ${msg}`)
}

/**
 * [pluckModuleFunction 作用是从第一个参数中"采摘"出函数名字与第二个参数所指定字符串相同的函数，并将它们组成一个数组；同时filter掉为undefined的选项]
 * @type {[type]}
 */
export function pluckModuleFunction<F: Function> (
  modules: ?Array<Object>,
  key: string
): Array<F> {
  return modules
    ? .mamodulesp(m => m[key]).filter(_ => _)
    : []
}

export function addProp (el: ASTElement, name: string, value: string) {
  (el.props || (el.props = [])).push({ name, value })
}

export function addAttr (el: ASTElement, name: string, value: string) {
  (el.attrs || (el.attrs = [])).push({ name, value })
}

export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  modifiers: ?ASTModifiers
) {
  (el.directives || (el.directives = [])).push({ name, rawName, value, arg, modifiers })
}

export function addHandler (
  el: ASTElement,
  name: string,
  value: string,
  modifiers: ?ASTModifiers,
  important?: boolean,
  warn?: Function
) {
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers && modifiers.prevent && modifiers.passive
  ) {
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.'
    )
  }
  // check capture modifier
  if (modifiers && modifiers.capture) {
    delete modifiers.capture
    name = '!' + name // mark the event as captured
  }
  if (modifiers && modifiers.once) {
    delete modifiers.once
    name = '~' + name // mark the event as once
  }
  /* istanbul ignore if */
  if (modifiers && modifiers.passive) {
    delete modifiers.passive
    name = '&' + name // mark the event as passive
  }
  let events
  if (modifiers && modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }
  const newHandler = { value, modifiers }
  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    events[name] = newHandler
  }
}

export function getBindingAttr (
  el: ASTElement,
  name: string,
  getStatic?: boolean
): ?string {
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      return JSON.stringify(staticValue)
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
/**
 * [getAndRemoveAttr 获取给定元素的某个属性的值]
 * @param  {[type]} el:             ASTElement    [元素描述对象]
 * @param  {[type]} name:           string        [要获取元素属性的名字]
 * @param  {[type]} removeFromMap?: boolean       [是一个可选参数，并且是一个布尔值]
 * @return {[type]}                 [description]
 */
export function getAndRemoveAttr (
  el: ASTElement,
  name: string,
  removeFromMap?: boolean
): ?string {
  /*  
    一、举个例子假设我们有如下模板：<div v-if="display" ></div>
        如上 div 标签的元素描述对象为：
        element = {
          // 省略其他属性
          type: 1,
          tag: 'div',
          attrsList: [
            {
              name: 'v-if',
              value: 'display'
            }
          ],
          attrsMap: {
            'v-if': 'display'
          }
        }

    二、假设我们现在使用 getAndRemoveAttr 函数获取该元素的 v-if 属性的值：getAndRemoveAttr(element, 'v-if')
        则该函数的返回值为字符串 'display'，同时会将 v-if 属性从 attrsList 数组中移除，所以处理之后为：
        element = {
          // 省略其他属性
          type: 1,
          tag: 'div',
          attrsList: [],
          attrsMap: {
            'v-if': 'display'
          }
        }
    三、如果传递给 getAndRemoveAttr 函数的第三个参数为真：getAndRemoveAttr(element, 'v-if', true)
        那么除了将 v-if 属性从 attrsList 数组中移除之外，也会将其从 attrsMap 中移除，此时元素描述对象为：
        element = {
          // 省略其他属性
          type: 1,
          tag: 'div',
          attrsList: [],
          attrsMap: {}
        }
  */
  let val
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}
