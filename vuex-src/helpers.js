/**
 * Reduce the code which written in Vue.js for getting the state.
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} states # Object's item can be a function which accept state and getters for param, you can do something for state and getters in it.
 * @param {Object}
 */
/*拿 mapState 写法举例：
  法一：数组写法
  computed: mapState([
    // 映射 this.count 为 store.state.count
    'count'
  ])
  法二：对象写法
  computed: {
    ...mapState({
      a: state => state.some.nested.module.a,
      b: state => state.some.nested.module.b
    })
  }
  法三：带有命名空间写法
  computed: {
    ...mapState('some/nested/module', {
      a: state => state.a,
      b: state => state.b
    })
  }
*/
/*执行流程：
  一、执行 normalizeNamespace(fn) -> 返回 fuc = function(namespace, map) {} 【namespace, map为形参】
  二、执行 mapState(a, b) 【a, b为实参】-> 实际是执行 fnc 函数，在 fuc 函数中规范化了 a, b 参数 -> 执行了 fn 函数，传入规范化的 a, b 参数            
*/
/*此处 namespace 和 states 是形参，实际参数是 mapState 执行时传入的参数*/
export const mapState = normalizeNamespace((namespace, states) => {
  const res = {}
  /*此时运行的 namespace 和 states 是已经规范化话的数据，兼容三种写法的 mapState*/
  normalizeMap(states).forEach(({ key, val }) => { /*forEach 的参数是 value 和 key，value是 {key: 'a', val: 1}*/
    res[key] = function mappedState () {
      /*vuex store 状态 state 对象*/
      let state = this.$store.state
      /*vuex store  getters 对象*/
      let getters = this.$store.getters
      /*存在命名空间*/
      if (namespace) {
        /*返回 namespace 字符串对应的  module*/
        const module = getModuleByNamespace(this.$store, 'mapState', namespace)
        /*module 不存在 停止执行*/
        if (!module) {
          return
        }
        /*获取当前 module 局部 state 状态*/
        state = module.context.state
        /*获取当前 module 局部 getters*/
        getters = module.context.getters
      }
      /*当前 key 对应的 value 是 vuex store 状态 state 对象对应的 key 值*/
      return typeof val === 'function'
        ? val.call(this, state, getters) /*假如 value 为函数的情况：执行此函数，传入 state 和 getters*/
        : state[val]
    }
    // mark vuex getter for devtools
    res[key].vuex = true
  })
  /*返回一个对象：1、对象的所有 key 是传入的 states 规范化后的所有 key、 2、对象 key 对应的 value 是 vuex store 状态 state 对象对应的 key 值*/
  return res
})

/**
 * Reduce the code which written in Vue.js for committing the mutation
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} mutations # Object's item can be a function which accept `commit` function as the first param, it can accept anthor params. You can commit mutation and do any other things in this function. specially, You need to pass anthor params from the mapped function.
 * @return {Object}
 */
export const mapMutations = normalizeNamespace((namespace, mutations) => {
  const res = {}
  normalizeMap(mutations).forEach(({ key, val }) => {
    res[key] = function mappedMutation (...args) {
      // Get the commit method from store
      let commit = this.$store.commit
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapMutations', namespace)
        if (!module) {
          return
        }
        commit = module.context.commit
      }
      return typeof val === 'function'
        ? val.apply(this, [commit].concat(args))
        : commit.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

/**
 * Reduce the code which written in Vue.js for getting the getters
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} getters
 * @return {Object}
 */
export const mapGetters = normalizeNamespace((namespace, getters) => {
  const res = {}
  normalizeMap(getters).forEach(({ key, val }) => {
    // The namespace has been mutated by normalizeNamespace
    val = namespace + val
    res[key] = function mappedGetter () {
      if (namespace && !getModuleByNamespace(this.$store, 'mapGetters', namespace)) {
        return
      }
      if (process.env.NODE_ENV !== 'production' && !(val in this.$store.getters)) {
        console.error(`[vuex] unknown getter: ${val}`)
        return
      }
      return this.$store.getters[val]
    }
    // mark vuex getter for devtools
    res[key].vuex = true
  })
  return res
})

/**
 * Reduce the code which written in Vue.js for dispatch the action
 * @param {String} [namespace] - Module's namespace
 * @param {Object|Array} actions # Object's item can be a function which accept `dispatch` function as the first param, it can accept anthor params. You can dispatch action and do any other things in this function. specially, You need to pass anthor params from the mapped function.
 * @return {Object}
 */
export const mapActions = normalizeNamespace((namespace, actions) => {
  const res = {}
  normalizeMap(actions).forEach(({ key, val }) => {
    res[key] = function mappedAction (...args) {
      // get dispatch function from store
      let dispatch = this.$store.dispatch
      if (namespace) {
        const module = getModuleByNamespace(this.$store, 'mapActions', namespace)
        if (!module) {
          return
        }
        dispatch = module.context.dispatch
      }
      return typeof val === 'function'
        ? val.apply(this, [dispatch].concat(args))
        : dispatch.apply(this.$store, [val].concat(args))
    }
  })
  return res
})

/**
 * Rebinding namespace param for mapXXX function in special scoped, and return them by simple object
 * @param {String} namespace
 * @return {Object}
 */
export const createNamespacedHelpers = (namespace) => ({
  mapState: mapState.bind(null, namespace),
  mapGetters: mapGetters.bind(null, namespace),
  mapMutations: mapMutations.bind(null, namespace),
  mapActions: mapActions.bind(null, namespace)
})

/**
 * Normalize the map
 * normalizeMap([1, 2, 3]) => [ { key: 1, val: 1 }, { key: 2, val: 2 }, { key: 3, val: 3 } ]
 * normalizeMap({a: 1, b: 2, c: 3}) => [ { key: 'a', val: 1 }, { key: 'b', val: 2 }, { key: 'c', val: 3 } ]
 * @param {Array|Object} map
 * @return {Object}
 */
function normalizeMap (map) {
  /*Array 或 Object 最后转为 map 对象*/
  return Array.isArray(map)
    ? map.map(key => ({ key, val: key })) /*数组*/
    : Object.keys(map).map(key => ({ key, val: map[key] })) /*对象*/
}

/**
 * Return a function expect two param contains namespace and map. it will normalize the namespace and then the param's function will handle the new namespace and the map.
 * @param {Function} fn
 * @return {Function}
 */
/*normalizeNamespace 其实是对 fn 做了一层包装：对 fn 的参数做了一个规范化处理，因为 fn 的参数有三种写法*/
function normalizeNamespace (fn) {
  /*拿 mapState 写法举例：
    法一：数组写法
    computed: mapState([
      // 映射 this.count 为 store.state.count
      'count'
    ])
    法二：对象写法
    computed: {
      ...mapState({
        a: state => state.some.nested.module.a,
        b: state => state.some.nested.module.b
      })
    }
    法三：带有命名空间写法
    computed: {
      ...mapState('some/nested/module', {
        a: state => state.a,
        b: state => state.b
      })
    }
  */
  /*此处 namespace 和 states 是形参，实际参数是 mapState 执行时传入的参数*/
  return (namespace, map) => {
    /*namespace 不是字符串，即 法一/法二 写法*/
    if (typeof namespace !== 'string') {
      /*map 为第一个参数：Array 或 Object*/
      map = namespace
      /*命名空间为空*/
      namespace = ''
    } 
    /*namespace 最后一个字符是 '/'，即 法三 写法*/
    else if (namespace.charAt(namespace.length - 1) !== '/') {
      /*namespace 最后一位拼接上 '/'*/
      namespace += '/'
    }
    /*返回 fn 函数，传入规范化的 namespace 和 map */
    return fn(namespace, map)
  }
}

/**
 * Search a special module from store by namespace. if module not exist, print error message.
 * @param {Object} store
 * @param {String} helper
 * @param {String} namespace
 * @return {Object}
 */
function getModuleByNamespace (store, helper, namespace) {
  /*namespace 字符串存储了对应的 module：store._modulesNamespaceMap[namespace] = module*/
  const module = store._modulesNamespaceMap[namespace]
  /*如果 module 不存在 打印存储*/
  if (process.env.NODE_ENV !== 'production' && !module) {
    console.error(`[vuex] module namespace not found in ${helper}(): ${namespace}`)
  }
  /*返回 namespace 对应的 module*/
  return module
}
