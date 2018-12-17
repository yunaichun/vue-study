import { forEachValue } from '../util'

// Base data struct for store's module, package with some attribute and method
/*实例当前模块：传入实例store传入的options对象*/
export default class Module {
  constructor (rawModule, runtime) {
    this.runtime = runtime
    // Store some children item
    /*存储当前模块的子模块*/
    this._children = Object.create(null)
    // Store the origin module object which passed by programmer
    /*实例store传入的options对象*/
    this._rawModule = rawModule
    /*options对象中的state状态*/
    const rawState = rawModule.state

    // Store the origin module's state
    /*state可以为函数，初始化为对象*/
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
  }

  /*获取当前模块的 namespaced，namespaced 可以不传*/
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  /*存储当前模块的子模块*/
  addChild (key, module) {
    this._children[key] = module
  }

  /*移除当前模块的子模块*/
  removeChild (key) {
    delete this._children[key]
  }

  /*获取当前模块指定的子模块*/
  getChild (key) {
    return this._children[key]
  }
  
  /*更新当前模块：命名空间、actions、mutations、getters*/
  update (rawModule) {
    /*更新命名空间*/
    this._rawModule.namespaced = rawModule.namespaced
    /*更新指定模块的 actions*/
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    /*更新指定模块的 mutations*/
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    /*更新指定模块的 getters*/
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  /*循环执行当前模块 子模块*/
  forEachChild (fn) {
    /*对当前模块 子模块 的每一项执行 fn 函数：传入 子模块 的 value 和 key*/
    forEachValue(this._children, fn)
  }

  /*循环执行当前模块 getters*/
  forEachGetter (fn) {
    /*当前模块存在 getters 配置项*/
    if (this._rawModule.getters) {
      /*对当前模块 getters 配置项的每一项执行 fn 函数：传入 getters 的 value 和 key*/
      forEachValue(this._rawModule.getters, fn)
    }
  }

  /*循环执行当前模块 actions*/
  forEachAction (fn) {
    /*当前模块存在 actions 配置项*/
    if (this._rawModule.actions) {
      /*对当前模块 actions 配置项的每一项执行 fn 函数：传入 actions 的 value 和 key*/
      forEachValue(this._rawModule.actions, fn)
    }
  }

  /*循环执行当前模块 mutations*/
  forEachMutation (fn) {
    /*当前模块存在 mutations 配置项*/
    if (this._rawModule.mutations) {
      /*对当前模块 mutations 配置项的每一项执行 fn 函数：传入 mutations 的 value 和 key*/
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
