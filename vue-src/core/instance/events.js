/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  // 该行代码创建了一个原型为null的空对象，并把它赋值给vm实例的_events属性
  // vm._events表示的是父组件绑定在当前组件上的事件 (https://www.imooc.com/article/30254)
  // 不包括组件内部methods和mounted等钩子方法
  vm._events = Object.create(null)

  // 该属性表示父组件是否通过"@hook:"把钩子函数绑定在当前组件上
  // @hook:钩子名称="绑定的函数"
  vm._hasHookEvent = false

  // init parent attached events
  // 初始化父组件添加的事件
  // vm.$options._parentListeners其实和上面的_events一样，都是用来表示父组件绑定在当前组件上的事件
  // _parentListeners后续再找吧?
  const listeners = vm.$options._parentListeners

  // 如果存在这些绑定的事件，那么就执行下面代码
  if (listeners) {
    // 如果事件存在，则调用updateComponentListeners更新这些方法
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

// 如果事件存在，则调用updateComponentListeners更新这些方法
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  // 这行代码的主要作用是保留对vm实例的引用
  // 在执行updateListeners方法时能访问到实例对象
  target = vm
  // 执行add和remove方法
  // listeners是父组件绑定在当前组件上的事件对象，
  // oldListeners表示当前组件上旧的事件对象
  // vm是vue实例对象。
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}

// 执行vue.$once方法或者执行vue.$on方法
function add (event, fn, once) {
  // 如果第三个参数once为true，则执行vue.$once方法，否则执行vue.$on方法
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

// 执行vue.$off方法
function remove (event, fn) {
  target.$off(event, fn)
}

/**
 * [eventsMixin  在 Vue.prototype 上添加了四个方法：$on、$once、$off、$emit]
 * @param  {[type]} Vue: Class<Component> [传入Vue构造函数]
 * @return {[type]}                       [description]
 */
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  // $on方法用来在vm实例上监听一个自定义事件，该事件可用$emit触发
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    // 先缓存this
    const vm: Component = this
    // 如果传入的事件是事件数组的话，则分别对数组内的每一项调用$on绑定事件
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } 

    else {
      // _events是表示直接绑定在组件上的事件，
      // 如果是通过$on新添加的事件（也相当于直接绑定在组件上的事件）,
      // 我们也要把事件和回调方法传入到_events对象中。
      /*
        _events: {
           event: [fn]
        }
       */
      }
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        /*
          如果是下列形式绑定的钩子，则_hasHookEvent属性为true。
            <child
              @hook:created="hookFromParent"
            >
          而像下面这种形式，它也存在钩子函数，但是它的_hasHookEvent就是false。
            const childComponent = Vue.component('child', {
              ...
              created () {
                console.log('child created')
              }
            })
         */
        // _hasHookEvent不是表示是否存在钩子，
        // 它表示的是父组件有没有直接绑定钩子函数在当前组件上
        vm._hasHookEvent = true
      }
    }
    // 最后是返回vm实例对象
    return vm
  }

  // $once监听一个只能触发一次的事件，在触发以后会自动移除该事件
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // event事件的真实回调是fn，这里又做了一层封装，间接回调是on函数
    function on () {
      // 先调用$off方法移除event事件的间接回调on函数
      vm.$off(event, on)
      // 再执行event事件的真实回调fn函数，这样就实现了只触发一次的功能
      fn.apply(vm, arguments)
    }
    on.fn = fn
    // 监听event事件，回调是on函数
    vm.$on(event, on)
    return vm
  }

  // $off用来移除自定义事件
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    // 如果没有提供参数，则移除所有的事件监听器；
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    // 如果event是数组则递归注销事件
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    // event不是数组，是指定的事件；cbs为指定event事件对应的所有回调函数
    const cbs = vm._events[event]
    // 如果此event本身没有回调，直接返回
    if (!cbs) {
      return vm
    }
    // 如果定event事件存在回调，则将回调全部清空
    if (arguments.length === 1) {
      vm._events[event] = null
      return vm
    }
    // 如果同时提供了事件与回调，则只移除这个回调的监听器。
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      while (i--) {
        cb = cbs[i]
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }

  // $emit用来触发指定的自定义事件
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    // 事件名称不能使驼峰形式: 'abcPAE'
    // 应该用-拼接 : 'abc-p-a-e'
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 获取_events对象存储的key为event的事件数组
    let cbs = vm._events[event]
    if (cbs) {
      // 将类数组的对象转换成数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 获取$emit的参数
      const args = toArray(arguments, 1)
      // 遍历执行事件
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          // 调用事件方法，传递参数
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
