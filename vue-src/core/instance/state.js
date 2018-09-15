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
  // 在 Vue 实例对象添加_watchers属性，其初始值是一个数组，这个数组将用来存储所有该组件实例的 watcher 对象
  vm._watchers = []
  const opts = vm.$options


  /*
    props 选项的初始化要早于 data 选项的初始化，那么这是不是可以使用 props 初始化 data 数据的原因呢？
    答案是：“是的”。
  */
  // 初始化props
  if (opts.props) initProps(vm, opts.props)
  // 初始化methods
  if (opts.methods) initMethods(vm, opts.methods)


  // 初始化data
  if (opts.data) {
    initData(vm)
  } else {
    // 如果不存在data选项则直接调用 observe 函数观测一个空对象：{}
    observe(vm._data = {}, true /* asRootData */)
  }


  // 初始化computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化watch （避免把 Firefox 中原生 watch 函数误认为是我们预期的 opts.watch 选项）
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * [initData 初始化Vue的data选项]
 * @param  {[type]} vm  [Vue实例]
 * @return {[type]}     [description]
 */
/*
  1、根据 vm.$options.data 选项获取真正想要的数据（注意：此时 vm.$options.data 是函数）
  2、校验得到的数据是否是一个纯对象
  3、检查数据对象 data 上的键是否与 props 对象上的键冲突
  4、检查 methods 对象上的键是否与 data 对象上的键冲突
  5、在 Vue 实例对象上添加代理访问数据对象的同名属性
  6、最后调用 observe 函数开启响应式之路
*/
function initData (vm: Component) {
  let data = vm.$options.data
  /*
    我们知道经过 mergeOptions 函数处理后 data 选项必然是一个函数，那么这里的判断还有必要吗？答案是有，
    这是因为 beforeCreate 生命周期钩子函数是在 mergeOptions 函数之后 initData 之前被调用的，
    如果在 beforeCreate 生命周期钩子函数中修改了 vm.$options.data 的值，
    那么在 initData 函数中对于 vm.$options.data 类型的判断就是必要的了。
  */
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // data函数已经转换成data数据了
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 使用 Object.keys 函数获取 data 对象的所有键
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    // 优先级的关系：props优先级 > data优先级 > methods优先级
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
    // 如果有错误发生那么则返回一个空对象作为数据对象：return {}
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
  /* 全局扩展的数据传递Vue.extend: https://blog.csdn.net/BorderBox/article/details/76650869
    <some-comp prop1="1" prop2="2" />
    解析出两个 props 的键值对，并生成一个对象：
    {
      prop1: '1',
      prop2: '2'
    }

    实际上这个对象就是 vm.$options.propsData 的值：
    vm.$options.propsData = {
      prop1: '1',
      prop2: '2'
    }
  */
  const propsData = vm.$options.propsData || {}
  // 定义了 props 常量和 vm._props 属性，它和 vm._props 属性具有相同的引用并且初始值为空对象：{}。目的是缓存props对象
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 并且常量 keys 与 vm.$options._propKeys 属性具有相同的引用，且初始值是一个空数组：[]。目的是缓存props属性的key
  const keys = vm.$options._propKeys = []
  // isRoot 常量用来标识是否是根组件，因为根组件实例的 $parent 属性的值是不存在的
  const isRoot = !vm.$parent
  // root instance props should be converted
  /* 
    一、根结点会给shouldConvert赋true，非根结点会给shouldConvert赋false
        当调用 observe 函数去观测一个数据对象时，只有当变量 shouldObserve 为真的时候才会进行观测
        所以，接下来根节点会对props进行观测，非根节点不会对props进行观测（数据来自已经是响应式的data，所以不需要重复观测了）

    二、所以我们可以得出一个结论：在定义 props 数据时，不将 prop 值转换为响应式数据，
        这里要注意的是：由于 props 本身是通过 defineReactive 定义的，所以 props 本身是响应式的，但没有对值进行深度定义。

    三、为什么这样做呢？
        很简单，我们知道 props 是来自外界的数据，或者更具体一点的说，props 是来自父组件的数据，
        这个数据如果是一个对象(包括纯对象和数组)，那么它本身可能已经是响应式的了，所以不再需要重复定义。
        另外在定义 props 数据之后，又设置observerState.shouldConvert = true将开关开启，这么做的目的是不影响后续代码的功能，因为这个开关是全局的。
  */
  observerState.shouldConvert = isRoot
  // 遍历属性props对象
  for (const key in propsOptions) { 
    /* props的key值存入keys中 */
    keys.push(key)
    /* validateProp 函数会返回给定名字的 prop 的值，也就是说常量 value 中保存着 prop 的值 */    
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      /*
        将 prop 的名字转为连字符加小写的形式，并将转换后的值赋值给 hyphenatedKey 常量
        例如：'AbcPAE' -> 'abc-p-a-e'
      */
      const hyphenatedKey = hyphenate(key)
      /*
        判断 prop 的名字是否是保留的属性(attribute)
        例如：key,ref,slot,slot-scope,is
      */
      if (isReservedAttribute(hyphenatedKey) || config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      /*
        defineReactive 函数的第四个参数是 customSetter，即自定义的 setter，
        这个 setter 会在你尝试修改 props 数据时触发，并打印警告信息提示你不要直接修改 props 数据

        注意：传递动态props写法（https://cn.vuejs.org/v2/guide/components.html#字面量语法-vs-动态语法）
      */
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      /*
        使用 defineReactive 函数将 prop 定义到常量 props 上，
        我们知道 props 常量与 vm._props 属性具有相同的引用，所以这等价于在 vm._props 上定义了 prop 数据
        
        所以 props 本身是响应式的，但没有对值进行深度定义
      */
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    /*
      只有当 key 不在组件实例对象上以及其原型链上没有定义时才会进行代理，这是一个针对子组件的优化操作，
      对于子组件来讲这个代理工作在创建子组件构造函数时就完成了，即在 Vue.extend 函数中完成的，
      这么做的目的是避免每次创建子组件实例时都会调用 proxy 函数去做代理，由于 proxy 函数中使用了 Object.defineProperty 函数，该函数的性能表现不佳，
      所以这么做能够提升一定的性能指标
    */
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
// 计算属性的观察者与非计算属性的观察者的行为是不一样的
const computedWatcherOptions = { lazy: true }
function initComputed (vm: Component, computed: Object) {
  // 为计算属性创建一个内部的监视器Watcher，保存在vm实例的_computedWatchers中 (引用传递)
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  // 服务端渲染
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    /* 可以参考 https://cn.vuejs.org/v2/guide/computed.html#计算-setter
      计算属性可以是一个函数，如下：
        computed: {
          someComputedProp () {
            return this.a + this.b
          }
        }
        
      另外计算属性也可以写成对象，如下：
        computed: {
          someComputedProp: {
            get: function () {
              return this.a + 1
            },
            set: function (v) {
              this.a = v - 1
            }
          }
        }
    */
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 在非生产环境下如果发现 getter 不存在，则直接打印警告信息，提示计算属性没有对应的 getter
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    /*
      只有在非服务端渲染时才会执行 if 语句块内的代码，因为服务端渲染中计算属性的实现本质上和使用 methods 选项差不多。
      这时 if 语句块内的代码会被执行，可以看到在 if 语句块内创建了一个观察者实例对象，我们称之为 计算属性的观察者，

      同时会把计算属性的观察者添加到 watchers 常量对象中，键值是对应计算属性的名字，
      注意由于 watchers 常量与 vm._computedWatchers 属性具有相同的引用，所以对 watchers 常量的修改相当于对 vm._computedWatchers 属性的修改，
      现在你应该知道了，vm._computedWatchers 对象是用来存储计算属性观察者的。
    */
    if (!isSSR) {
      // create internal watcher for the computed property.
      /*
        为计算属性创建一个内部的监视器Watcher，保存在vm实例的_computedWatchers中
        这里的computedWatcherOptions参数传递了一个lazy为true，会使得watch实例的dirty为true
      */
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
    // 调用 defineComputed 定义计算属性
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // computed的key值在选项data中
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } 
      // props存在，且computed的key值在选项props中
      else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
// 定义计算属性
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 值与 initComputed 函数中定义的 isSSR 常量的值是取反的关系，也是一个布尔值，
  // 用来标识是否应该缓存值，也就是说只有在非服务端渲染的情况下计算属性才会缓存值。
  const shouldCache = !isServerRendering()
  
  /*
    计算属性是一个函数，如下：
      computed: {
        someComputedProp () {
          return this.a + this.b
        }
      }
  */
  if (typeof userDef === 'function') {
    // 创建计算属性的getter
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key) // 浏览器端
      : userDef // 服务端（由于服务端渲染不需要缓存值，所以直接使用 userDef 函数作为 sharedPropertyDefinition.get 的值）
    /*
      由于 userDef 是函数，这说明该计算属性并没有指定 set 拦截器函数，
      所以直接将其设置为空函数 noop：sharedPropertyDefinition.set = noop。
    */
    sharedPropertyDefinition.set = noop
  }
  /*
    计算属性是一个对象，如下：
      computed: {
        someComputedProp: {
          get: function () {
            return this.a + 1
          },
          set: function (v) {
            this.a = v - 1
          }
        }
      }
  */
  else {
    sharedPropertyDefinition.get = userDef.get // userDef.get 函数存在
      ? shouldCache && userDef.cache !== false // 浏览器端，同时没有指定选项 userDef.cache 为假
        ? createComputedGetter(key) 
        : userDef.get
      : noop // get不存在
    sharedPropertyDefinition.set = userDef.set // userDef.set 函数存在
      ? userDef.set
      : noop
  }
  /*  
    总之，无论 userDef 是函数还是对象，在非服务端渲染的情况下，配置对象 sharedPropertyDefinition 最终将变成如下这样：
    sharedPropertyDefinition = {
      enumerable: true,
      configurable: true,
      get: createComputedGetter(key),
      set: userDef.set // 或 noop
    }

    举个例子，假如我们像如下这样定义计算属性：
    computed: {
      someComputedProp () {
        return this.a + this.b
      }
    }

    那么定义 someComputedProp 访问器属性时的配置对象为：
    sharedPropertyDefinition = {
      enumerable: true,
      configurable: true,
      get: createComputedGetter(key),
      set: noop // 没有指定 userDef.set 所以是空函数
    }
  */
 
  /*
    在非生产环境下如果发现 sharedPropertyDefinition.set 的值是一个空函数，那么说明开发者并没有为计算属性定义相应的 set 拦截器函数，
    这时会重写 sharedPropertyDefinition.set 函数，这样当你在代码中尝试修改一个没有指定 set 拦截器函数的计算属性的值时，就会得到一个警告信息。
  */
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }

  // 将计算属性变为访问器属性
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
// 创建计算属性的getter：传入计算属性的key名称
function createComputedGetter (key) {
  // 计算属性真正的 get 拦截器函数就是 computedGetter 函数
  return function computedGetter () {
    // 计算属性一个内部的监视器Watcher，保存在vm实例的_computedWatchers中
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      /*  
          计算属性的观察者是惰性求值：
          1、this.lazy = this.dirty = true
          2、计算属性通过观察者的 evaluate 方法触发手动求值
      */
      if (watcher.dirty) {
        /* 实际调用: watcher.get() -> watcher.getter() -> computed.get()
          一、evaluate 方法中求值的那句代码最终所执行的求值函数就是用户定义的计算属性的 get 函数。举个例子，假设我们这样定义计算属性：
              computed: {
                compA () {
                  return this.a +1
                }
              }

          二、那么对于计算属性 compA 来讲，执行其计算属性观察者对象的 wather.evaluate 方法求值时，本质上就是执行如下函数进行求值：
              compA () {
                return this.a +1
              }

          三、大家想一想这个函数的执行会发生什么事情？
              我们知道数据对象的 a 属性是响应式的，所以如上函数的执行将会触发属性 a 的 get 拦截器函数。
              所以这会导致属性 a 将会收集到一个依赖，这个依赖实际上就是计算属性的观察者对象。
        */
        watcher.evaluate()
      }

      /*  
        Dep.target 属性的值是什么，我们回想一下整个过程：
        首先   渲染函数的执行  会读取计算属性 compA 的值，从而触发计算属性 compA 的 get 拦截器函数，最终调用了 this.dep.depend() 方法收集依赖。
        
        这个过程中的关键一步就是  渲染函数的执行，   我们知道在渲染函数执行之前 Dep.target 的值必然是 渲染函数的观察者对象。
        所以计算属性观察者对象的 this.dep 属性中所收集的就是渲染函数的观察者对象。
      */
      if (Dep.target) {
        // watcher调用Dep的方法: 收集该watcher的所有deps依赖
        watcher.depend()
      }
      // 返回computed.get()的值
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
      /*一、方法没有定义
        这段代码用来检测该方法是否真正的有定义，
        如果没有定义则打印警告信息，提示开发者是否正确地引用了函数
      */
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      /*二、方法名在props中有定义
        我们知道 props 选项的初始化要先于 methods 选项，并且每个 prop 都需要挂载到组件实例对象下，
        如此一来 methods 选项中的方法名字很有可能与 props 选项中的属性名字相同，这样会导致覆盖的问题，
        为此需要检测 methods 选项中定义的方法名字是否在 props 选项中有定义
      */
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      /*三、方法名为保留字段
        检测方法名字 key 是否已经在组件实例对象 vm 中有了定义，并且该名字 key 为保留的属性名，什么是保留的属性名呢？
        根据 isReserved 函数可知以字符 $ 或 _ 开头的名字为保留名，
        如果这两个条件都成立，说明你定义的方法与 Vue 原生提供的内置方法冲突，比如：
          methods: {
            $set () {
              alert('这个方法将覆盖 Vue 原生 $set 方法')
            }
          }

        如上代码中我们定义了 $set 方法，但是 Vue 已经内置了叫做 $set 的方法，
        如果允许这样做那么 Vue 内置的方法将被覆盖，所以需要打印警告信息提示开发者
      */
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }

    /*
      通过这句代码可知，之所以能够通过组件实例对象访问 methods 选项中定义的方法，
      就是因为在组件实例对象上定义了与 methods 选项中所定义的同名方法，

      当然了在定义到组件实例对象之前要检测该方法是否真正的有定义：methods[key] == null，
      如果没有则添加一个空函数到组件实例对象上。
    */
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
    /*
      通过这个条件我们可以发现 handler 常量可以是一个数组，handler 常量是什么呢？
      它的值是 watch[key]，也就是说我们在使用 watch 选项时可以通过传递数组来实现创建多个观察者，如下：
        watch: {
          name: [
            function () {
              console.log('name 改变了1')
            },
            function () {
              console.log('name 改变了2')
            }
          ]
        }

      总的来说，在 Watcher 类的基础上，无论是实现 $watch 方法还是实现 watch 选项，都变得非常容易，这得益于一个良好的设计。
    */
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}
// Vue.prototype.$watch的第二个参数cb是对象的情况
function createWatcher (
  vm: Component, // Vue实例
  keyOrFn: string | Function, // 监听对象
  handler: any, // 回调
  options?: Object
) {
  if (isPlainObject(handler)) {
    /* 回调是对象
      watch: {
          test: {
              handler: function () {},
              deep: true
          }
      }
    */
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    /* 回调是字符串
      watch: {
        name: 'handleNameChange'
      },
      methods: {
        handleNameChange () {
          console.log('name change')
        }
      }
    */
    handler = vm[handler]
  }
  // 用$watch方法创建一个watch来观察该对象的变化
  return vm.$watch(keyOrFn, handler, options) // key、cb
}


/**
 * [stateMixin  在Vue.prototype上定义三个方法：$set、$delete 以及 $watch；$data和$props数据代理_data和_props]
 * @param  {[type]} Vue: Class<Component> [传入Vue构造函数]
 * @return {[type]}                       [description]
 */
export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  // 开发环境为 $data 和 $props 这两个属性设置一下 set，
  // 实际上就是提示你一下：别他娘的想修改我，老子无敌。
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
  // 数据绑定: 将$data加在Vue.prototype上；$data 属性实际上代理的是 _data 这个实例属性
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  // 数据绑定: 将$props加在Vue.prototype上；$props 代理的是 _props 这个实例属性
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  /*
    https://cn.vuejs.org/v2/api/#vm-set
    用以将data之外的对象绑定成响应式的
  */
  Vue.prototype.$set = set
  /*
    https://cn.vuejs.org/v2/api/#vm-delete
    与set对立，解除绑定
  */
  Vue.prototype.$delete = del

  /*
    https://cn.vuejs.org/v2/api/#vm-watch
    $watch方法
    用以为对象建立观察者监视变化
  */
  // $watch是对Watcher的封装
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    /*一、cb是对象的情况*/
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    /*二、cb不是对象是函数的情况*/
    options = options || {}
    // 用户手动创建观察者
    options.user = true
    // 实例Watcher观察者
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // 有immediate参数的时候会立即执行回调函数
    if (options.immediate) {
      // 不过此时回调函数的参数只有新值没有旧值
      cb.call(vm, watcher.value)
    }
    
    // $watch 函数返回一个函数，这个函数的执行会解除当前观察者对属性的观察
    return function unwatchFn () {
      // 将自身从所有依赖收集订阅列表删除
      watcher.teardown()
    }
  }
}
