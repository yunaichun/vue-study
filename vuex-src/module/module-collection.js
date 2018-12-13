import Module from './module'
import { assert, forEachValue } from '../util'

/*Vuex 支持 store 分模块传入，存储分析后的 modules
  ModuleCollection主要将实例store传入的options对象整个构造为一个module对象，
  并循环调用 this.register([key], rawModule, false) 为其中的 modules 属性进行模块注册，
  使其都成为module对象，最后options对象被构造成一个完整的组件树。
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
      const parent = this.get(path.slice(0, -1))
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }

  get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  getNamespace (path) {
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }

  update (rawRootModule) {
    update([], this.root, rawRootModule)
  }
  
  unregister (path) {
    const parent = this.get(path.slice(0, -1))
    const key = path[path.length - 1]
    if (!parent.getChild(key).runtime) return

    parent.removeChild(key)
  }
}

function update (path, targetModule, newModule) {
  if (process.env.NODE_ENV !== 'production') {
    assertRawModule(path, newModule)
  }

  // update target module
  targetModule.update(newModule)

  // update nested modules
  if (newModule.modules) {
    for (const key in newModule.modules) {
      if (!targetModule.getChild(key)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[vuex] trying to add a new module '${key}' on hot reloading, ` +
            'manual reload is needed'
          )
        }
        return
      }
      update(
        path.concat(key),
        targetModule.getChild(key),
        newModule.modules[key]
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
