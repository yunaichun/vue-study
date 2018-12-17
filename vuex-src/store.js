/*installl vuex：使 vue 所有组件可以通过 this.$store 获取到 store 实例*/
import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert } from './util'

let Vue // bind on install

export class Store {
  constructor (options = {}) {
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    /*局部变量 Vue 没有赋值，但是处于浏览器环境下且加载过Vue：则执行install方法*/
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }


    /*一、环境判断*/
    if (process.env.NODE_ENV !== 'production') {
      /*Vue.use(Vuex) 必须在 new Vuex.Store之前，即必须先装载vuex*/
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      /*Promise 必须要支持 */
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      /*Vuex.store 必须用 new 实例出来*/
      assert(this instanceof Store, `store must be called with the new operator.`)
    }


    /*二、数据初始化、module树构造*/
    const {
      plugins = [],
      strict = false
    } = options

    // store internal state
    /*是否在进行提交状态标识*/
    this._committing = false
    /*acitons 操作对象*/
    this._actions = Object.create(null)
    this._actionSubscribers = []
    /*mutations 操作对象*/
    this._mutations = Object.create(null)
    /*封装后的 getters 集合对象*/
    this._wrappedGetters = Object.create(null)
    /*根据Store传入的配置项，构建模块 module 树，整棵 module 树存放在 this.root 属性上：
      1、Vuex 支持 store 分模块传入，存储分析后的 modules；
      2、ModuleCollection 主要将实例 store 传入的 options 对象整个构造为一个 module 对象，
         并循环调用 this.register([key], rawModule, false) 为其中的 modules 属性进行模块注册，
         使其都成为 module 对象，最后 options 对象被构造成一个完整的组件树。
    */
    this._modules = new ModuleCollection(options)
    /*模块命名空间 map*/
    this._modulesNamespaceMap = Object.create(null)
    /*订阅函数集合，Vuex提供了 subscribe 功能*/
    this._subscribers = []
    /*Vue 组件用于 watch 监视变化*/
    this._watcherVM = new Vue()

    // bind commit and dispatch to self
    /*三、封装替换原型中的 dispatch 和 commit 方法，将this指向当前store对象*/
    const store = this
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    /*获取根组件的state*/
    const state = this._modules.root.state

    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    /*四、module 安装：
      1、存储命名空间 namespace 对应的 module 在 store 的 _modulesNamespaceMap 属性中
      2、设置当前 module 为响应式、
      3、设置当前 module 局部的 dispatch、commit 方法以及 getters 和 state
      4、将局部的 mutations 注册到全局 store 的 _mutations 属性下、
         将局部的 actions 注册到全局 store 的 _actions 属性下、
         将局部的 getters 注册到全局 store 的 _wrappedGetters 属性下、
         子 module 的安装
    */
    installModule(this, state, [], this._modules.root)

    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    /*五、store 组件的初始化：设置新的 store._vm 的 Vue 实例，主要是将 _wrappedGetters 作为 computed 属性*/
    resetStoreVM(this, state)

    // apply plugins
    /*六、最后执行 plugin 的注入*/
    plugins.forEach(plugin => plugin(this))

    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    if (useDevtools) {
      devtoolPlugin(this)
    }
  }

  /**
   * [state 获取 store._vm 实例的状态]
   * @return {[type]} [description]
   */
  get state () {
    return this._vm._data.$$state
  }

  /**
   * [state 设置 store._vm 实例的状态]
   * @param  {[Any]} v  [store._vm 实例的新状态]
   * @return {[type]}   [description]
   */
  set state (v) {
    /*只能通过 _withCommit 修改 state 的状态*/
    if (process.env.NODE_ENV !== 'production') {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  /**
   * [commit commit方法触发mutations]
   * @param  {[type]} _type    [类型]
   * @param  {[type]} _payload [载荷]
   * @param  {[type]} _options []
   * @return {[type]}          [description]
   */
  commit (_type, _payload, _options) {
    /*统一commit传入参数：
      1、以载荷形式分发（默认提取为type、payload）
         store.commit('incrementAsync', { amount: 10 })
      2、以对象形式分发
         store.commit({ type: 'incrementAsync', amount: 10 })
    */
    // check object-style commit
    const {
      type,
      payload,
      options /*以对象形式分发时，第二个参数为options*/
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    /*根据 type 获取对应的 mutations*/
    const entry = this._mutations[type]
    /*不存在此 mutation type，报错不再往下执行*/
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    /*1、存在此action type：专用修改state方法，其他修改state方法均是非法修改*/
    this._withCommit(() => {
      /*批量触发mutation处理函数*/
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })
    /*2、存在此action type：批量触发mutation处理函数后，通知所有_subscribers（订阅函数）本次操作的mutation对象以及当前的state状态*/
    this._subscribers.forEach(sub => sub(mutation, this.state))

    /*如果传入了已经移除的silent选项则进行提示警告*/
    if (
      process.env.NODE_ENV !== 'production' &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  /**
   * [dispatch dispatch方法触发actions]
   * @param  {[type]} _type    [类型]
   * @param  {[type]} _payload [载荷]
   * @return {[Promise]}       [返回Promise]
   */
  dispatch (_type, _payload) {
    /*统一dispatch传入参数：
      1、以载荷形式分发（默认提取为type、payload）
         store.dispatch('incrementAsync', { amount: 10 })
      2、以对象形式分发
         store.dispatch({ type: 'incrementAsync', amount: 10 })
    */
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    /*根据 type 获取对应的 actions*/
    const entry = this._actions[type]
    /*不存在此 action type，报错不再往下执行*/
    if (!entry) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    /*存在此action type，逐个执行_actionSubscribers*/
    this._actionSubscribers.forEach(sub => sub(action, this.state))

    /*返回Promise*/
    return entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)
  }

  /**
   * [_withCommit 专用修改state方法，其他修改state方法均是非法修改]
   * @param  {Function} fn [mutation函数：执行state的修改操作]
   * @return {[type]}      [description]
   */
  _withCommit (fn) {
    /*缓存this._committing状态*/
    const committing = this._committing
    /*回调函数执行前：修改this._committing状态为true*/
    /*进行本次提交，若不设置为true，直接修改state，strict模式下，Vuex将会产生非法修改state的警告*/
    this._committing = true
    /*mutation函数：执行state的修改操作*/
    fn()
    /*回调函数执行后：重置this._committing状态为初始值*/
    this._committing = committing
  }

  /**
   * [replaceState 提供“时空穿梭”功能，即 state 操作的前进和倒退]
   * @param  {[Object]} state [[store 实例的 state ]
   * @return {[type]}         [description]
   */
  replaceState (state) {
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  /**
   * [subscribe 在 commit 函数中执行的订阅函数]
   * @param  {Function} fn [订阅回调函数]
   * @return {[type]}      [description]
   */
  subscribe (fn) {
    return genericSubscribe(fn, this._subscribers)
  }

  /**
   * [subscribeAction 在 dispatch 函数中执行的订阅函数]
   * @param  {Function} fn [订阅回调函数]
   * @return {[type]}      [description]
   */
  subscribeAction (fn) {
    return genericSubscribe(fn, this._actionSubscribers)
  }

  /**
   * [watch vuex 提供监听 state 和 getter 变化的 watch]
   * @param  {[Function]}   getter  [监听求值函数]
   * @param  {[Function]}   cb      [回调函数]
   * @param  {[Object]}     options [配置对象]
   * @return {[type]}               [description]
   */
  watch (getter, cb, options) {
    if (process.env.NODE_ENV !== 'production') {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    /*this._watcherVM 是一个 Vue 实例，含有 $watch 功能*/
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  

  registerModule (path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path]

    if (process.env.NODE_ENV !== 'production') {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    this._modules.register(path, rawModule)
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    resetStoreVM(this, this.state)
  }

  unregisterModule (path) {
    if (typeof path === 'string') path = [path]

    if (process.env.NODE_ENV !== 'production') {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1))
      Vue.delete(parentState, path[path.length - 1])
    })
    resetStore(this)
  }

  hotUpdate (newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }
}

/**
 * [unifyObjectStyle 统一dispatch、commit参数]
 * @param  {[String/Object]}   type    [类型]
 * @param  {[Object]}          payload [载荷]
 * @param  {[type]}            options [值为payload]
 * @return {[type]}                    [description]
 */
function unifyObjectStyle (type, payload, options) {
  /*统一dispatch传入参数：
    1、以载荷形式分发（默认提取为type、payload）
       store.dispatch('incrementAsync', { amount: 10 })
    2、以对象形式分发
       store.dispatch({ type: 'incrementAsync', amount: 10 })
  */

  /*以对象形式分发：store.dispatch({ type: 'incrementAsync', amount: 10 })*/
  if (isObject(type) && type.type) {
    /*以对象形式分发时，第二个参数为options*/
    options = payload
    /*从第一个参数中提取出type*/
    payload = type
    /*从第一个参数中提取出type*/
    type = type.type
  }

  if (process.env.NODE_ENV !== 'production') {
    /*假如分理出的t ype不是string类型，报错*/
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  /*最终返回出对象：包含type、payload、options属性*/
  return { type, payload, options }
}

/**
 * [installModule module 安装：1、存储命名空间 namespace 对应的 module 在 store 的 _modulesNamespaceMap 属性中
 *                             2、设置当前 module 为响应式、
 *                             3、设置当前 module 局部的 dispatch、commit 方法以及 getters 和 state
 *                             4、将局部的 mutations 注册到全局 store 的 _mutations 属性下、
 *                                将局部的 actions 注册到全局 store 的 _actions 属性下、
 *                                将局部的 getters 注册到全局 store 的 _wrappedGetters 属性下、
 *                                子 module 的安装
 * ] 
 * @param  {[Class]}   store      [store 实例 this ]
 * @param  {[Object]}  rootState  [根组件 state]
 * @param  {[Array]}   path       [模块路径：初始为空数组]
 * @param  {[Module]}  module     [根组件的 module：初始为 this._modules.root]
 * @param  {[Boolean]} hot        [是否是热更新]
 * @return {[type]}               [description]
 */
function installModule (store, rootState, path, module, hot) {
  /*根 module 模块路径为空数组*/
  const isRoot = !path.length

  /*根据当前传入 path，获取对应的 module 模块的命名空间*/
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  /*一、存储命名空间 namespace 对应的 module 在 store 的 _modulesNamespaceMap 属性中*/
  if (module.namespaced) {
    /*将命名空间 namespace 字符串路径存入 Store*/
    store._modulesNamespaceMap[namespace] = module
  }

  // set state
  /*二、非根 module 模块 并且 非热更新：设置当前 moduleName 为响应式，数据为当前 module 的 state*/
  if (!isRoot && !hot) {
    /*根据当前传入 path（除去最后一项，即自身；此时 path 最后一项为 当前 path 的父级），获取父模块*/
    const parentState = getNestedState(rootState, path.slice(0, -1))
    /*当前 module 的名称*/
    const moduleName = path[path.length - 1]
    /*非根 module 设置 state*/
    store._withCommit(() => {
      /*parentState：父 module；moduleName：当前 module 名称；module.state：当前 module 的状态*/
      Vue.set(parentState, moduleName, module.state)
    })
  }

  /*三、定义 local 变量和 module.context 的值：设置当前 module 局部的 dispatch、commit 方法以及 getters 和 state（由于 namespace 的存在需要做兼容处理）*/
  const local = module.context = makeLocalContext(store, namespace, path)

  /*四、循环执行当前模块 mutations*/
  module.forEachMutation((mutation, key) => {
    /*含有 namespace 的当前 module 的 mutation 的名称*/
    const namespacedType = namespace + key
    /*将局部的 mutations 注册到全局 store 的 _mutations 属性下：this.$store._mutations.testMutations[0]({ amount: 100 });*/
    registerMutation(store, namespacedType, mutation, local)
  })

  /*四、循环执行当前模块 actions*/
  module.forEachAction((action, key) => {
    /*含有 namespace 的当前 module 的 action 的名称*/
    const type = action.root ? key : namespace + key
    const handler = action.handler || action
    /*将局部的 actions 注册到全局 store 的 _actions 属性下：this.$store._actions.testActions[0]({ amount: 100 }, callback);*/
    registerAction(store, type, handler, local)
  })

  /*四、循环执行当前模块 getters*/
  module.forEachGetter((getter, key) => {
     /*含有 namespace 的当前 module 的 getters 的名称*/
    const namespacedType = namespace + key   
    /*将局部的 getters 注册到全局 store 的 _wrappedGetters 属性下*/
    registerGetter(store, namespacedType, getter, local)
  })

  /*四、循环执行当前模块 子模块*/
  module.forEachChild((child, key) => {
    /*子 module 安装*/
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * [getNestedState 根据当前传入 path 获取模块 module 的 state]
 * @param  {[Object]} state [根节点的 state ]
 * @param  {[Array]}  path  [当前传入 module 的路径]
 * @return {[Object]}       [返回]
 */
function getNestedState (state, path) {
  return path.length
    ? path.reduce((state, key) => state[key], state) /*非根 module： 根据 path 层级定位到*/
    : state /*根 module：根 module 的 state*/
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
/**
 * [makeLocalContext 为该module设置局部的 dispatch、commit方法以及getters和state]
 * @param  {[Class]}  store     [store 实例 this ]
 * @param  {[String]} namespace [当前 module 的命名空间]
 * @param  {[Array]}  path      [模块路径：初始为空数组]
 * @return {[type]}             [description]
 */
function makeLocalContext (store, namespace, path) {
  /*没有命名空间*/
  const noNamespace = namespace === ''

  const local = {
    /*设置 module 局部 dispatch：兼容次 module 是否有 namespace */
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      /*统一dispatch参数*/
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      /*如果不存在 options 或者 options.root = false/undefined*/
      if (!options || !options.root) {
        /*修改了 type，拼接了 namespace*/
        type = namespace + type
        /*如果 store._actions 没有此 type 报错*/
        if (process.env.NODE_ENV !== 'production' && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      /*对 store.dispatch 做了一层包装*/
      return store.dispatch(type, payload)
    },

    /*设置 module 局部 commit：兼容次 module 是否有 namespace */
    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      /*统一commit参数*/
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      /*如果不存在 options 或者 options.root = false/undefined*/
      if (!options || !options.root) {
        /*修改了 type，拼接了 namespace*/
        type = namespace + type
        /*如果 store._mutations 没有此 type 报错*/
        if (process.env.NODE_ENV !== 'production' && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      /*对 store.commit 做了一层包装*/
      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  Object.defineProperties(local, {
    /*设置 module 局部 getters：兼容次 module 是否有 namespace */
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace) /*对 store.getters 做了一层包装*/
    },
    /*设置 module 局部 state */
    state: {
      /*根据当前传入 path 获取模块 module 的 state*/
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

/**
 * [makeLocalGetters 有命名空间的情况：设置 module 局部的 getters（对 store.getters 做了一层包装） ]
 * @param  {[Class]}  store       [store 实例 this ]
 * @param  {[String]} namespace   [当前 module 的命名空间]
 * @return {[Object]}             [gettersProxy]
 */
function makeLocalGetters (store, namespace) {
  const gettersProxy = {}

  /*命名空间 namespace 的长度*/
  const splitPos = namespace.length
  /*循环遍历 store 的getters 的每一项（store.getters在哪里定义暂无）*/
  Object.keys(store.getters).forEach(type => {
    // skip if the target getter is not match this namespace
    /* 判断目标 getter 是否等于此 命名空间 namespace
      1、假如命名空间 namespace 为 'account/posts/popular' 
      2、store.getters 某一项为 'account/posts/popular' 
    */
    if (type.slice(0, splitPos) !== namespace) return

    // extract local getter type
    /*提取局部 module 的 getter：其实是对具体 getters 加了一层包装，添加了命名空间*/
    const localType = type.slice(splitPos)

    // Add a port to the getters proxy.
    // Define as getter property because
    // we do not want to evaluate the getters in this time.
    /*对 store.getters 做了一层包装*/
    Object.defineProperty(gettersProxy, localType, {
      get: () => store.getters[type],
      enumerable: true
    })
  })

  return gettersProxy
}

/**
 * [registerMutation 将局部的 mutations 注册到全局 store 的 _mutations 属性下]
 * @param  {[Class]}    store     [store 实例 this]
 * @param  {[String]}   type      [含有 namespace 的当前 module 的 mutation 的名称]
 * @param  {[Function]} handler   [当前 module 的 mutations 为 type 的值]
 * @param  {[Object]}   local     [module.context：当前 module 局部的 dispatch、commit 方法以及 getters 和 state]
 * @return {[type]}               [description]
 */
function registerMutation (store, type, handler, local) {
  /*将局部的 mutations 注册到全局 store 的 _mutations 属性下：每一项都是一个数组*/
  const entry = store._mutations[type] || (store._mutations[type] = [])
  entry.push(function wrappedMutationHandler (payload) {
    /*执行 store._mutations[type][0](payload) <=> 实际是 store 调用 handler，传入当前模块的state 和 payload*/
    handler.call(store, local.state, payload)
  })
}

/**
 * [registerAction 将局部的 actions 注册到全局 store 的 _actions 属性下]
 * @param  {[Class]}    store     [store 实例 this]
 * @param  {[String]}   type      [含有 namespace 的当前 module 的 action 的名称]
 * @param  {[Function]} handler   [当前 module 的 actions 为 type 的值]
 * @param  {[Object]}   local     [module.context：当前 module 局部的 dispatch、commit 方法以及 getters 和 state]
 * @return {[Promise]}            [返回Promise]
 */
function registerAction (store, type, handler, local) {
  /*将局部的 actions 注册到全局 store 的 _actions 属性下：每一项都是一个数组*/
  const entry = store._actions[type] || (store._actions[type] = [])
  entry.push(function wrappedActionHandler (payload, cb) {
    /*执行 store._actions[type][0](payload, cb) <=> 实际是 store 调用 handler，传入当前模块的 state 和 payload、cb*/
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload, cb)
    /*将 action 执行结果转为 Promise，可以链式调用*/
    if (!isPromise(res)) {
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) {
      /*store含有_devtoolHook配置选项的话，添加异常捕获*/
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      /*返回Promise*/
      return res
    }
  })
}

/**
 * [registerGetter 将局部的 getters 注册到全局 store 的 _wrappedGetters 属性下]
 * @param  {[Class]}    store       [store 实例 this]
 * @param  {[String]}   type        [含有 namespace 的当前 module 的 action 的名称]
 * @param  {[Function]} rawGetter   [当前 module 的 getters 为 type 的值]
 * @param  {[Object]}   local       [module.context：当前 module 局部的 dispatch、commit 方法以及 getters 和 state]
 * @return {[Promise]}              [返回Promise]
 */
function registerGetter (store, type, rawGetter, local) {
  /*getters 命名不能重复*/
  if (store._wrappedGetters[type]) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  /*将局部的 actions 注册到全局 store 的 _wrappedGetters 属性下：每一项是一个函数*/
  store._wrappedGetters[type] = function wrappedGetter (store) {
    /*当前 module 的 getters 为 type 的值参数：当前 module 的 state 和 getters、全局的 store 和 getters*/
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}

/**
 * [resetStoreVM store 组件的初始化：设置新的 store._vm 的 Vue 实例，主要是将 _wrappedGetters 作为 computed 属性]
 * @param  {[Class]}     store [store 实例 this]
 * @param  {[Object]}    state [根节点的 state]
 * @param  {[Boolean]}   hot   [是否是热更新]
 * @return {[type]}       [description]
 */
function resetStoreVM (store, state, hot) {
  /*缓存前 store._vm 组件：
    1、Vuex其实构建的就是一个名为 store._vm 的Vue实例组件，
    2、所有配置的state、actions、mutations以及getters都是其组件的属性，所有的操作都是对这个vm组件进行的
  */
  const oldVm = store._vm

  // bind store public getters
  store.getters = {}
  const wrappedGetters = store._wrappedGetters
  const computed = {}
  /*一、循环所有 getters：
    1、新建 computed 对象进行存储，
    2、通过 Object.defineProperty 方法为 getters 对象建立属性，使得我们通过 this.$store.getters.xxxgetter 能够访问到该 getters
  */
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    /*wrappedGetters 绑定到新建 store._vm 实例的计算属性 computed 上*/
    computed[key] = () => fn(store)
    /*this.$store.getters.key  ===  store._vm[key]（通过计算属性获取的）*/
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  /*暂时将Vue设为静默模式，避免报出用户加载的某些插件触发的警告*/
  const silent = Vue.config.silent
  Vue.config.silent = true
  /*二、设置新的 store._vm 的 Vue 实例，主要是将 _wrappedGetters 作为 computed 属性*/
  store._vm = new Vue({
    data: {
      $$state: state /*当前组件的 state */
    },
    computed /*当前组件的 _wrappedGetters */
  })
  /*恢复Vue的模式*/
  Vue.config.silent = silent

  // enable strict mode for new vm
  /*三、该方法对 state 执行 $watch 以禁止从 mutation 外部修改 state*/
  if (store.strict) {
    enableStrictMode(store)
  }

  /*四、若不是初始化过程执行的该方法，将旧的组件 state 设置为 null，强制更新所有监听者(watchers)，
  待更新生效，DOM 更新完成后，执行 vm 组件的 destroy 方法进行销毁，减少内存的占用*/
  if (oldVm) {
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy())
  }
}

/**
 * [enableStrictMode 对 state 执行 $watch 以禁止从 mutation 外部修改 state]
 * @param  {[Class]} store [store 实例 this]
 * @return {[type]}        [description]
 */
function enableStrictMode (store) {
  /*对 store._vm 此 vue 进行实例数据监听，确保 state 的修改必须是由 mutation 操作*/
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (process.env.NODE_ENV !== 'production') {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

/**
 * [genericSubscribe 通用订阅函数]
 * @param  {Function} fn   [回调函数]
 * @param  {[type]}   subs [回调函数]
 * @return {[type]}        [description]
 */
function genericSubscribe (fn, subs) {
  /*保证 subs 数组中含有 fn 项*/
  if (subs.indexOf(fn) < 0) {
    subs.push(fn)
  }
  /*返回一个函数*/
  return () => {
    /*fn 项在数组 subs 中的索引*/
    const i = subs.indexOf(fn)
    /*移除subs 数组中的 fn*/
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

function resetStore (store, hot) {
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

/**
 * [install   Vue.use(vuex) -> 执行 vuex 插件的 install 方法 -> 执行 applyMixin -> 使vue每个组件this.$store = options.store]
 * @param  {[Vue]}  _Vue [传入的是Vue的实例]
 * @return {[type]}      [description]
 */
export function install (_Vue) {
  /*只允许一次 Vue.use(Vuex) */
  if (Vue && _Vue === Vue) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  /*若是首次加载，将局部 Vue 变量赋值为全局的 Vue 对象，并执行 applyMixin 方法*/
  Vue = _Vue
  /*installl vuex：使 vue 所有组件可以通过 this.$store 获取到 store 实例*/
  applyMixin(Vue)
}
