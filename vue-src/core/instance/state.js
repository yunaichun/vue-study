/* @flow */

import config from '../config'
import Dep from '../observer/dep'
import Watcher from '../observer/watcher'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  observerState,
  defineReactive
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

// 文件中共享的访问器属性定义
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop, // 初始未空函数
  set: noop // 初始未空函数
}

/**
 * [initState 初始化state]
 * @param  {[type]} vm: Component     [Vue实例]
 * @return {[type]}                   [description]
 */
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 初始化data
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化props
  if (opts.props) initProps(vm, opts.props)
  // 初始化methods
  if (opts.methods) initMethods(vm, opts.methods)
  // 初始化computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * [initData 初始化Vue的data选项]
 * @param  {[type]} vm  [Vue实例]
 * @return {[type]}     [description]
 */
function initData (vm: Component) {
  let data = vm.$options.data
  // 此时 vm.$options.data 的值应该是通过 mergeOptions 合并处理后的 mergedInstanceDataFn 函数，
  // 所以判断data是不是'function'，接着实例对象上定义 _data 属性，该属性与 data 是相同的引用
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 组件的数据选项必须是一个函数，以便每个实例都可以维护返回的数据对象的独立副本：
  // 如果data选项不是function，一个实例的data将影响所有其他实例的数据
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 遍历data对象
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // 循环的目的是在实例对象上对数据进行代理，这样我们就能通过 this.a 来访问 data.a 了
  // 代码的处理是在 proxy 函数中，该函数是在实例对象上设置与 data 属性同名的访问器属性，然后使用 _data 做数据劫持
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // vue methods中存在和data中同名的数据属性
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // vue props中存在和data中同名的数据属性
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } 
    // data属性名不是$或_开头的话，设置数据代理
    else if (!isReserved(key)) {
      // 数据代理：app.text = app._data.text
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 做完数据的代理，就正式进入响应系统
  observe(data, true /* asRootData */)
}
/**
 * [getData 获取数据：vm.$options.data是一个函数]
 * @param  {[type]} data: Function      [初始data选项数据]
 * @param  {[type]} vm:   Component     [Vue实例]
 * @return {[type]}                     [description]
 */
function getData (data: Function, vm: Component): any {
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  }
}
/**
 * [proxy 设置数据代理]
 * @param  {[type]} target:    Object        [vue实例]
 * @param  {[type]} sourceKey: string        [_data]
 * @param  {[type]} key:       string        [key]
 * @return {[type]}                          [description]
 */
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key] // this._data[key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val // this._data[key] = val;
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * [initProps 初始化Vue的props选项]
 * @param  {[type]} vm:           Component     [Vue实例]
 * @param  {[type]} propsOptions: Object        [初始props选项数据]
 * @return {[type]}                             [description]
 */
function initProps (vm: Component, propsOptions: Object) {
  // https://blog.csdn.net/BorderBox/article/details/76650869
  // 全局扩展的数据传递: Vue.extend
  const propsData = vm.$options.propsData || {}
  // 缓存props对象 (引用传递)
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存props属性的key (引用传递)
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  // 根结点会给shouldConvert赋true，根结点的props应该被转换
  observerState.shouldConvert = isRoot
  // 遍历属性props对象
  for (const key in propsOptions) { 
    // props的key值存入keys中【由于数组为引用传递，同时存入vm.$options._propKeys】
    keys.push(key)
    // 获取props为key对应的属性值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    // 开发环境
    if (process.env.NODE_ENV !== 'production') {
      // 获取prop的key的连字符('AbcPAE' -> 'abc-p-a-e')
      const hyphenatedKey = hyphenate(key)
      // 当前prop的key值是否有(key,ref,slot,slot-scope,is)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) { // prop属性名是保留字符
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      // 将props对象的属性key转换为访问器属性
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          // 由于父组件重新渲染的时候会重写prop的值，所以应该直接使用prop来作为一个data或者计算属性的依赖
          // https://cn.vuejs.org/v2/guide/components.html#字面量语法-vs-动态语法
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else { // 生产环境
      // 将props对象的属性key转换为访问器属性
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 静态prop在Vue.extend()期间已经在组件原型上代理了
    // 我们只需要在这里进行代理prop
    if (!(key in vm)) {
      // 数据代理：app.text = app._props.text
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}


/**
 * [initComputed 初始化Vue的computed选项]
 * @param  {[type]} vm:       Component     [Vue实例]
 * @param  {[type]} computed: Object        [初始computed选项数据]
 * @return {[type]}                         [description]
 */
const computedWatcherOptions = { lazy: true }
function initComputed (vm: Component, computed: Object) {
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

/**
 * [initMethods 初始化Vue的methods选项]
 * @param  {[type]} vm:      Component     [Vue实例]
 * @param  {[type]} methods: Object        [初始methods选项数据]
 * @return {[type]}                        [description]
 */
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

/**
 * [initWatch 初始化Vue的watch选项]
 * @param  {[type]} vm:    Component     [Vue实例]
 * @param  {[type]} watch: Object        [初始watch选项数据]
 * @return {[type]}                      [description]
 */
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}
function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(keyOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // $watch是对Watcher的封装
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 有immediate参数的时候会立即执行
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    // 返回一个取消观察函数，用来停止触发回调
    return function unwatchFn () {
      // 将自身从所有依赖收集订阅列表删除
      watcher.teardown()
    }
  }
}
