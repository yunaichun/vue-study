import Module from './module'
import { assert, forEachValue } from '../util'

/*根据Store传入的配置项，构建模块 module 树，整棵 module 树存放在 this.root 属性上：
  1、Vuex 支持 store 分模块传入，存储分析后的 modules；
  2、ModuleCollection 主要将实例 store 传入的 options 对象整个构造为一个 module 对象，
     并循环调用 this.register([key], rawModule, false) 为其中的 modules 属性进行模块注册，
     使其都成为 module 对象，最后 options 对象被构造成一个完整的组件树。
  3、假设实例 Store 如下：
       const store = new Vuex.Store({
        modules: {
          account: {
            namespaced: true,

            // 模块内容（module assets）
            state: { ... }, // 模块内的状态已经是嵌套的了，使用 `namespaced` 属性不会对其产生影响
            getters: {
              isAdmin () { ... } // -> getters['account/isAdmin']
            },
            actions: {
              login () { ... } // -> dispatch('account/login')
            },
            mutations: {
              login () { ... } // -> commit('account/login')
            },

            // 嵌套模块
            modules: {
              // 继承父模块的命名空间
              myPage: {
                state: { ... },
                getters: {
                  profile () { ... } // -> getters['account/profile']
                }
              },

              // 进一步嵌套命名空间
              posts: {
                namespaced: true,

                state: { ... },
                getters: {
                  popular () { ... } // -> getters['account/posts/popular']
                }
              }
            }
          }
        }
      })
    则 var test = new ModuleCollection(options) 之后为：
    1、test.root = newModule(options)
    2、test.root._children[account] = newModule(options2)
*/
export default class ModuleCollection {
  /*rawRootModule 为实例store传入的options对象*/
  constructor (rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  /**
   * [register 循环调用自身：为 store 的 modules 属性进行模块注册]
   * @param  {[Array]}   path      [path初始值为空数组，存储module路径的]
   * @param  {[Object]}  rawModule [实例store传入的options对象]
   * @param  {Boolean}   runtime   [runtime 默认为true]
   * @return {[type]}              [description]
   */
  register (path, rawModule, runtime = true) {
    /*实例store传入的options对象中的getters、mutations、actions传入的值的类型的判断*/
    if (process.env.NODE_ENV !== 'production') {
      assertRawModule(path, rawModule)
    }

    /*实例当前模块：传入实例store传入的options对象*/
    const newModule = new Module(rawModule, runtime)
    /*根模块*/
    if (path.length === 0) {
      /*存取根模块实例*/
      this.root = newModule
    } 
    /*子模块*/
    else {
      /*获取当前模块的父模块：path.slice(0, -1) 除去 path 最后一项，即自身；此时 path 最后一项为 当前 path 的父级*/
      const parent = this.get(path.slice(0, -1))
      /*将当前模块添加至父模块的 _children 属性中*/
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    /*options配置中包含modules选项，对子模块循环注册*/
    if (rawModule.modules) {
      /*循环遍历modules：执行回调，传入 modules 的 value 和 key 值*/
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        /*这里对 path 操作了：path.concat(key)*/
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  /*根据当前传入 path（除去最后一项，即自身；此时 path 最后一项为 当前 path 的父级），获取父模块*/
  get (path) {
    /*reduce 传入初始值 this.root，为根模块*/
    return path.reduce((module, key) => {
      /*归并思想：从根模块 module 开始获取其子模块*/
      return module.getChild(key) /*此时key即为 path 的每一项*/
    }, this.root)
  }

  /*获取当前传入 path 对应的 module 模块的命名空间*/
  getNamespace (path) {
    /*获取根模块*/
    let module = this.root
    /*循环遍历 path 数组，返回最终拼接的 path 每一项*/
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  /*更新模块 module 树的配置*/
  update (rawRootModule) {
    update([], this.root, rawRootModule)
  }
  
  /*移除当前传入 path 对应的 module 模块*/
  unregister (path) {
    /*获取当前path的父模块：path.slice(0, -1) 除去 path 最后一项，即自身；此时 path 最后一项为 当前 path 的父级*/
    const parent = this.get(path.slice(0, -1))
    /*获取 path 数组最后一项*/
    const key = path[path.length - 1]
    /* 
      1、当前 path 模块的 runtime 值为 false 直接返回;
      2、注册模块是，runtime默认为 true
    */
    if (!parent.getChild(key).runtime) return

    /*移除当前模块：即将其父模块的 _children 删除掉当前模块*/
    parent.removeChild(key)
  }
}

/**
 * [update 更新模块 module 树的配置]
 * @param  {[Array]}  path         [命名空间，更新时传入空数组 []]
 * @param  {[Object]} targetModule [已构建的 module 树，更新时传入 this.root]
 * @param  {[Object]} newModule    [新的 Store 的 options 配置项]
 * @return {[type]}              [description]
 */
function update (path, targetModule, newModule) {
  /*更新store传入的options对象中的getters、mutations、actions传入的值的类型的判断*/
  if (process.env.NODE_ENV !== 'production') {
    assertRawModule(path, newModule)
  }

  // update target module
  /*做了四件事：更新命名空间、更新 actions、更新 mutations、更新 getters*/
  targetModule.update(newModule)

  // update nested modules
  /*更新嵌套 modules*/
  if (newModule.modules) {
    /*循环遍历 modules*/
    for (const key in newModule.modules) {
      /*如果之前 modules 中不含有此key 项，直接返回*/
      if (!targetModule.getChild(key)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      /*递归调用更新*/
      update(
        path.concat(key), /*传入当前 module 的 path*/
        targetModule.getChild(key), /*传入当前模块已构建的 module 树*/
        newModule.modules[key] /*传入当前模块更新的配置项*/
      )
    }
  }
}

/*assert(value): value 为 function 时返回 true*/
const functionAssert = {
  assert: value => typeof value === 'function',
  expected: 'function'
}

/*assert(value): value 为 function 或 object 时返回 true*/
const objectAssert = {
  assert: value => typeof value === 'function' ||
    (typeof value === 'object' && typeof value.handler === 'function'),
  expected: 'function or object with "handler" function'
}

/*定义常量*/
const assertTypes = {
  getters: functionAssert,
  mutations: functionAssert,
  actions: objectAssert
}

/**
 * [assertRawModule 实例store传入的options对象中的getters、mutations、actions传入的值的类型的判断]
 * @param  {[Array]}  path      [path初始值为空数组，存储module路径的]
 * @param  {[Object]} rawModule [实例store传入的options对象]
 * @return {[type]}             [description]
 */
function assertRawModule (path, rawModule) {
  /*循环遍历getters、mutations、actions集合*/
  Object.keys(assertTypes).forEach(key => {
    /*实例store传入的options对象不含getters、mutations、actions配置项，直接返回不再往下执行*/
    if (!rawModule[key]) return

    /*获取getters、mutations、actions断言条件*/
    const assertOptions = assertTypes[key]

    /* rawModule[key]：遍历实options中getters、mutations、actions*/
    /* forEachValue：传入 rawModule[key] 的 value + key
      如下：
      const store = new Vuex.Store({
        state: {},
        getters: {
          doubleIncrement(state) {
            return state.count * 2;
          },
          doneTodos(state) {
            return state.todos.filter(todo => todo.done);
          }
        }
      });

      当 key 为 getters，rawModule[key] 为 { doubleIncrement(state) {}, doneTodos(state) {} }
      1、value 为 function(state) {}, type 为 key 值即 doubleIncrement
      2、value 为 function(state) {}, type 为 key 值即 doneTodos
    */
    forEachValue(rawModule[key], (value, type) => {
      assert(
        assertOptions.assert(value), /*condition 为 false 时打印 msg 信息*/
        makeAssertionMessage(path, key, type, value, assertOptions.expected) /*condition 为 false 时打印 msg 信息*/
      )
    })
  })
}

/**
 * [makeAssertionMessage 实例store传入的options对象中的getters、mutations、actions传入的值的类型的不满足条件时打印的错误信息]
 * @param  {[Array]}  path     [path初始值为空数组，存储module路径的]
 * @param  {[Object]} key      [getters、mutations、actions]
 * @param  {[String]} type     [getters、mutations、actions中的key]
 * @param  {[Object]} value    [getters、mutations、actions中的value]
 * @param  {[String]} expected [getters、mutations、actions期待的信息]
 * @return {[String]}          [返回最终的错误信息]
 */
function makeAssertionMessage (path, key, type, value, expected) {
  let buf = `${key} should be ${expected} but "${key}.${type}"`
  if (path.length > 0) {
    buf += ` in module "${path.join('.')}"`
  }
  buf += ` is ${JSON.stringify(value)}.`
  return buf
}
