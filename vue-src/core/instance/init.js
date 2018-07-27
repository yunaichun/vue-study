/*
细流程第一步：使用策略对象合并参数选项

细流程第二步：初始化工作与Vue实例对象的设计
1、是 initLifecycle，这个函数的作用就是在实例上添加一些属性，
2、是 initEvents，由于 vm.$options._parentListeners 的值为 undefined 所以也仅仅是在实例上添加属性， vm._updateListeners(listeners) 并不会执行，
   由于我们只传递了 el 和 data，所以 initProps、initMethods、initComputed、initWatch 这四个方法什么都不会做，只有 initData 会执行。
3、是 initRender，除了在实例上添加一些属性外，由于我们传递了 el 选项，所以会执行 vm.$mount(vm.$options.el)


综上所述：
let v = new Vue({
    el: '#app',
    data: {
        a: 1,
        b: [1, 2, 3]
    }
})
初始化工作只包含两个主要内容即：initState 和 initRender
*/
/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // ------第一步：使用策略对象合并参数选项------
      // 第一个参数就是 Vue.options
      // 第二个参数是我们调用Vue构造函数时的参数选项
      // 第三个参数是 vm 也就是 this 对象
      // vm.$options = mergeOptions(
      //   {
      //       components: {
      //           KeepAlive,
      //           Transition,
      //           TransitionGroup
      //       },
      //       directives: {
      //           model,
      //           show
      //       },
      //       filters: {},
      //       _base: Vue
      //   },
      //   {
      //       el: '#app',
      //       data: {
      //           a: 1,
      //           b: [1, 2, 3]
      //       }
      //   },
      //   vm
      // )
      // ------细流程第二步：初始化工作与Vue实例对象的设计------
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
      // ------[在生产环境下会为实例添加两个属性，并且属性值都为实例本身vm._renderProxy = vm   vm._self = vm]------
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    // 一定会调用的
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    // 由于我们只传递了 el 和 data，所以 initProps、initMethods、initComputed、initWatch 这四个方法什么都不会做，只有 initData 会执行
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // ------最后在 initRender 中如果有 vm.$options.el 还要调用 vm.$mount(vm.$options.el)------
    // ------这就是为什么如果不传递 el 选项就需要手动 mount 的原因了------
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  // ------通过传入的 vm.constructor 我们可以知道，其实就是 Vue 构造函数本身------
  // ------相当于 let options = Vue.options------
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // ------直接返回了 Vue.options------
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
