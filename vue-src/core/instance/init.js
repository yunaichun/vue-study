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

/**
 * [initMixin 在Vue.prototype上定义_init方法，构造Vue实例的时候会调用这个_init方法来初始化Vue实例]
 * @param  {[type]} Vue: Class<Component> [传入Vue构造函数]
 * @return {[type]}                       [description]
 */
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    // 首先缓存当前的上下文到vm变量中，方便之后调用
    const vm: Component = this
    // a uid
    // 设置_uid属性。_uid属性是唯一的。
    // 当触发init方法，新建Vue实例时（当渲染组件时也会触发）uid都会递增
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 如果传入值的_isVue为ture时(即传入的值是Vue实例本身)不会新建observer实例，
    // 即vm实例自身被观察的标志位
    vm._isVue = true

    // merge options
    // 当前这个Vue实例是组件，这个选项是 Vue 内部使用的
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 优化内部组件实例化，因为动态选项合并是相当慢的，
      // 并且内部组件选项中没有一个需要特殊处理。
      initInternalComponent(vm, options)
    } 
    // 当前Vue实例不是组件。而是实例化Vue对象时，调用mergeOptions方法
    else {
      // 使用策略对象合并参数选项
      vm.$options = mergeOptions(
        // vm.constructor为Vue实例的constructor，指向Vue构造函数
        resolveConstructorOptions(vm.constructor), // 返回Vue的options参数Vue.options (父级options是否改变、本身options是否改变)
        options || {}, // 实例化时传入的options
        vm // 当前Vue实例
      )
    }

    /* istanbul ignore else */
    // 设置渲染函数的作用域代理
    if (process.env.NODE_ENV !== 'production') {
      // proxy是一个强大的特性，为我们提供了很多"元编程"能力。对vm做了一个数据劫持
      initProxy(vm)
    } else {
      // 如果不是开发环境，则vue实例的_renderProxy属性指向vue实例本身。 
      vm._renderProxy = vm
    }

    // expose real self
    // 注意 vm._self 和 vm._renderProxy 不同，
    // 首先在用途上来说寓意是不同的，另外 vm._renderProxy 有可能是一个代理对象，即 Proxy 实例。
    vm._self = vm
    // initLifeCycle方法用来初始化一些生命周期相关的属性，以及为parent,child等属性赋值
    initLifecycle(vm)
    // initEvents方法用来初始化事件
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    // initInjections方法用来初始化inject
    initInjections(vm) // resolve injections before data/props
    // initState方法用来初始化data选项，将数据data变为可观察的
    initState(vm)
    // initProvide方法用来初始化provide
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // 有el选项，挂载元素
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**
 * [initInternalComponent 优化内部组件实例化，因为动态选项合并是相当慢的，并且内部组件选项中没有一个需要特殊处理。]
 * @param  {[type]} vm:      Component                [Vue实例函数]
 * @param  {[type]} options: InternalComponentOptions [description]
 * @return {[type]}                                   [description]
 */
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

/**
 * [resolveConstructorOptions 返回Vue的options参数Vue.options (父级options是否改变、本身options是否改变) ]
 * @param  {[type]} Ctor: Class<Component> [vm.constructor: 其为Vue实例的constructor，指向Vue构造函数]
 * @return {[type]}                        [description]
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  /* 相当于 let options = Vue.options  (vm.constructor = Vue)
    Vue.options = {
      components: {
          KeepAlive,
          Transition,
          TransitionGroup
      },
      directives: {
          model,
          show
      },
      filters: {},
      _base: Vue
    }
   */
  let options = Ctor.options

  /*
    Vue.extend方法会为子类添加一个super属性，指向其父类构造器：
      Vue.extend = function (extendOptions: Object): Function {
        ...
        Sub['super'] = Super
        ...
      }
    如下：
      const Sub = Vue.extend()
      const s = new Sub()
      s.constructor 自然就是 Sub 而非 Vue
    所以:
      当Ctor是基础构造器的时候，resolveConstructorOptions方法返回基础构造器的options。
      当Ctor是通过Vue.extend构造的子类，resolveConstructorOptions方法返回合并后的options。
  */
  if (Ctor.super) {
    // 递归调用返回"父类"上的options，并赋值给superOptions变量
    const superOptions = resolveConstructorOptions(Ctor.super) // Ctor.super.options
    /*
      然后把"自身"的options赋值给cachedSuperOptions变量 (未被Vue.mixin前的Vue.extend 的 options)
      Sub.superOptions = Super.options -------(/core/gloabal-api/extend.js)--------
    */
    const cachedSuperOptions = Ctor.superOptions

    /*
      比较这两个变量的值,当这两个变量值不等时，说明"父类"的options改变过了
      例如执行了Vue.mixin方法，这时候就需要把"自身"的superOptions属性替换成最新的, 之后检查"自身"的options是否发生变化？
      
      举个例子来说明一下：
      var Profile = Vue.extend({
         template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>'
      })
      Vue.mixin({ data: function () {
        return {
          firstName: 'Walter',
          lastName: 'White',
          alias: 'Heisenberg'
        }
      }})
      new Profile().$mount('#example')  // (其中Profile为父类，Vue是子类)
      由于Vue.mixin改变了"父类"options。源码中superOptions和cachedSuperOptions就不相等了
    */
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
            
      // 把"自身"的superOptions属性替换成最新的
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 之后检查"自身"的options是否发生变化？
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      // 如果”自身“有新添加的options，
      // 则把新添加的options属性添加到Ctor.extendOptions属性上
      if (modifiedOptions) {
        // 对象浅拷贝：Ctor.extendOptions拷贝modifiedOptions
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 调用mergeOptions方法合并  "父类"构造器上的options  和"自身"上的extendOptions
      // 最后返回合并后的options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // 返回Vue.options
  return options
}
/**
 * [resolveModifiedOptions 检查"自身"的options是否发生变化 (返回Ctor.options中属于Ctor.extendOptions，或者不属于Ctor.sealedOptions的选项)]
 * @param  {[type]} Ctor: Class<Component> [vm.constructor: 其为Vue实例的constructor，指向Vue构造函数]
 * @return {[type]}                        [返回latest中属于extended的选项，或latest中不属于sealed中的选项]
 */
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  // 定义modified变量
  let modified
  // 自身的options
  const latest = Ctor.options
  // 构造"自身"时传入的options (Vue.extend中的options)
  const extended = Ctor.extendOptions
  // 执行Vue.extend时封装的"自身"options，这个属性就是方便检查"自身"的options有没有变化 (Vue.minin中的options)
  const sealed = Ctor.sealedOptions
  /*
    遍历当前构造器上的options属性，如果在"自身"封装的options里没有，则证明是新添加的。
    执行if内的语句。调用dedupe方法，最终返回modified变量(即"自身新添加的options")
  */
  for (const key in latest) {
    // latest的key值与sealed的key值不等
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      // 返回latest中属于extended的选项，或latest中不属于sealed中的选项
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}
/**
 * [dedupe 返回latest中属于extended的选项，或latest中不属于sealed中的选项]
 * @param  {[type]} latest   [Ctor.options[key]]
 * @param  {[type]} extended [Ctor.extendOptions[key]]
 * @param  {[type]} sealed   [Ctor.sealedOptions]
 * @return {[type]}          [modified[key]]
 */
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  /*
    lateset表示的是"自身"新增的options;
    extended表示的是当前构造器上新增的extended options;
    sealed表示的是当前构造器上新增的封装options。
  */
  // latest是数组
  if (Array.isArray(latest)) {
    const res = []
    // sealed不是数组改为数组
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    // extended不是数组改为数组
    extended = Array.isArray(extended) ? extended : [extended]
    // 遍历latest
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      /*
        如果latest是数组，一般这个新增的options就是生命周期钩子函数，则遍历该数组，
        如果该数组的某项在extended数组中有或者在sealed数组中没有，则推送到返回数组中从而实现去重。
        这个去重逻辑目前自己还不是特别明白，之后如果明白了会在这里更新，
      */
      // extended中含有latest[i] 或者 sealed中不含有latest[i]
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    // 返回latest中属于extended的选项，或者latest中不属于sealed中的选项
    return res
  } else {
    // 非数组直接返回第一个参数
    return latest
  }
}
