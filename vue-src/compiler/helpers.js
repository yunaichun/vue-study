/* @flow */

import { parseFilters } from './parser/filter-parser'

export function baseWarn (msg: string) {
  console.error(`[Vue compiler]: ${msg}`)
}

/**
 * [addDirective 添加v-text、v-html、v-show、v-cloak、v-model、自定义指令到元素对象上]
 * @param {[type]} el:        ASTElement    [当前元素描述对象]
 * @param {[type]} name:      string        [绑定属性的名字(custom)]
 * @param {[type]} rawName:   string        [绑定属性的名字(v-custom:arg.modif)]
 * @param {[type]} value:     string        [绑定属性的值]
 * @param {[type]} arg:       ?string       [参数字符串(arg)]
 * @param {[type]} modifiers: ?ASTModifiers [修饰符]
 */
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

/**
 * [addHandler 添加v-on(或者@)绑定的事件到元素对象上]
 * @param {[type]} el:         ASTElement    [当前元素描述对象]
 * @param {[type]} name:       string        [绑定属性的名字，即事件名称]
 * @param {[type]} value:      string        [绑定属性的值，这个值有可能是事件回调函数名字，有可能是内联语句，有可能是函数表达式]
 * @param {[type]} modifiers:  ?ASTModifiers [指令对象(修饰符)]
 * @param {[type]} important?: boolean       [可选参数，是一个布尔值，代表着添加的事件侦听函数的重要级别，如果为 true，则该侦听函数会被添加到该事件侦听函数数组的头部，否则会将其添加到尾部]
 * @param {[type]} warn?:      Function      [打印警告信息的函数，是一个可选参数]
 */
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
  /*passive 修饰符不能和 prevent 修饰符一起使用，因为在事件监听中 passive 选项参数就是用来告诉浏览器该事件监听函数是不会阻止默认行为的。*/
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
  /*如果使用了 capture 修饰符，会把事件名称 'click' 修改为 '!click'。*/
  if (modifiers && modifiers.capture) {
    delete modifiers.capture
    name = '!' + name // mark the event as captured
  }
  /*如果使用了 capture 修饰符，会把事件名称 'click' 修改为 '~click'。*/
  if (modifiers && modifiers.once) {
    /*如下两段代码是等价的：
      <div @click.once="handleClick"></div>
      等价于：
      <div @~click="handleClick"></div>
    */
    delete modifiers.once
    name = '~' + name // mark the event as once
  }
  /* istanbul ignore if */
  /*如果使用了 capture 修饰符，会把事件名称 'click' 修改为 '&click'。*/
  if (modifiers && modifiers.passive) {
    delete modifiers.passive
    name = '&' + name // mark the event as passive
  }
  let events
  /*如果使用了 native 修饰符，会在元素描述对象添加events或者nativeEvents属性*/
  if (modifiers && modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }
  /*newHandler：v-on属性值 + 修饰符对象*/
  const newHandler = { value, modifiers }
  /*初始handlers是undefined*/
  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    /*有超过两个相同事件：
      1、假设我们有如下模板代码：
        <div @click.prevent="handleClick1" @click="handleClick2" @click.self="handleClick3"></div>
        handlers保存的是第一次被添加的事件信息，newHandler 对象是第二个 click 事件侦听的信息对象
        el.events = {
          click: [
            {
              value: 'handleClick1',
              modifiers: { prevent: true }
            },
            {
              value: 'handleClick2'
            },
            {
              value: 'handleClick2',
              modifiers: { self: true }
            }
          ]
        }
    */
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
   /*有两个相同事件：
      1、假设我们有如下模板代码：
        <div @click.prevent="handleClick1" @click="handleClick2"></div>
        如上模板所示，我们有两个 click 事件的侦听，其中一个 click 事件使用了 prevent 修饰符，而另外一个 click 事件则没有使用修饰符，
        所以这两个 click 事件是不同，但这两个事件的名称却是相同的，都是 'click'，
        所以这将导致调用两次 addHandler 函数添加两次名称相同的事件，
        但是由于第一次调用 addHandler 函数添加 click 事件之后元素描述对象的 el.events 对象已经存在一个 click 属性，如下：
        el.events = {
          click: {
            value: 'handleClick1',
            modifiers: { prevent: true }
          }
        }
      2、handlers保存的是第一次被添加的事件信息，newHandler 对象是第二个 click 事件侦听的信息对象
        el.events = {
          click: [
            {
              value: 'handleClick1',
              modifiers: { prevent: true }
            },
            {
              value: 'handleClick2'
            }
          ]
        }
    */
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    /*只有一个事件：
      1、假设我们有如下模板代码：
         <div @click.once="handleClick"></div>
         如上模板中监听了 click 事件，并绑定了名字叫做 handleClick 的事件监听函数，所以此时 newHandler 对象应该是：
         newHandler = {
           value: 'handleClick',
           modifiers: {} // 注意这里是空对象，因为 modifiers.once 修饰符被 delete 了
         }

      2、又因为使用了 once 修饰符，所以事件名称将变为字符串 '~click'，
         又因为在监听事件时没有使用 native 修饰符，所以 events 变量是元素描述对象的 el.events 属性的引用，
         所以调用 addHandler 函数的最终结果就是在元素描述对象的 el.events 对象中添加相应事件的处理结果：
         el.events = {
           '~click': {
              value: 'handleClick',
              modifiers: {}
            }
         }
    */
    events[name] = newHandler
  }
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

/**
 * [addAttr 将属性的名字和值以对象的形式添加到元素描述对象的 el.attrs 数组中]
 * @param {[type]} el:    ASTElement [元素的描述对象]
 * @param {[type]} name:  string     [属性的名字]
 * @param {[type]} value: string     [属性的值]
 */
export function addAttr (el: ASTElement, name: string, value: string) {
  (el.attrs || (el.attrs = [])).push({ name, value })
}

/**
 * [addProp 将属性的名字和值以对象的形式添加到元素描述对象的 el.props 数组中]
 * @param {[type]} el:    ASTElement [元素的描述对象]
 * @param {[type]} name:  string     [属性的名字]
 * @param {[type]} value: string     [属性的值]
 */
export function addProp (el: ASTElement, name: string, value: string) {
  (el.props || (el.props = [])).push({ name, value })
}

/**
 * [getBindingAttr 获取绑定的属性值]
 * @param  {[type]} el:         ASTElement    [元素描述对象]
 * @param  {[type]} name:       string        [要获取的属性的名字]
 * @param  {[type]} getStatic?: boolean       [description]
 * @return {[type]}             [description]
 */
export function getBindingAttr (
  el: ASTElement,
  name: string,
  getStatic?: boolean
): ?string {
  /*获取绑定的动态属性值:  v-bind: 或者 : */
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)
  /*v-bind:a='' 或者 v-bind:a='b'*/
  if (dynamicValue != null) {
    /* 动态属性解析：解析过滤器
      1、平时开发中使用过滤器更多的场景是如下这种方式：：
         <div>{{ date | format('yy-mm-dd') }}</div>
      2、实际上对于绑定的属性值同样可以使用过滤器，如下：
         <div :key="id | featId"></div>
    */
    return parseFilters(dynamicValue)
  }
  /* 1、v-bind:a
     2、不传递第三个参数getStatic，则参数 getStatic 的值为 undefined，它不全等于 false
  */
  else if (getStatic !== false) {
    /* 静态属性解析：返回静态属性值
      1、当为元素或组件添加属性时，这个属性可以是绑定的也可以是非绑定的，
      2、所以当获取绑定的属性失败时，我们不能够认为开发者没有编写该属性，而应继续尝试获取非绑定的属性值。
    */
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      /*使用 JSON.stringify 函数处理其属性值的原因，目的就是确保将非绑定的属性值作为字符串处理，而不是变量或表达式。*/
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
