/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 一个观察者解析表达式，进行依赖收集的观察者，
// 同时在表达式数据变更时触发回调函数。它被用于$watch api以及指令
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean; // stateMixin： 用户手动创建观察者 (core/instance/state.js)
  lazy: boolean; // initComputed，computedWatcherOptions参数传递了一个lazy为true会使得watch实例的dirty为true (core/instance/state.js)
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm
    // _watchers存放订阅者实例
    vm._watchers.push(this)
    // options
    if (options) {
      // 判断变量a为非空，未定义或者非空串才能执行方法体的内容
      // a!=null&&typeof(a)!=undefined&&a!=''
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers【进行脏检查用的】
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    // 表达式expOrFn为函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 实例Watcher的时候对表达式求值，即实例属性data的取值，从发触发依赖的收集
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 将自身watcher观察者实例设置给Dep.target，用以依赖收集
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 对表达式求值，触发依赖的收集
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果存在deep，则触发每个深层对象的依赖，追踪其变化
      if (this.deep) {
        // 递归每一个对象或者数组，触发它们的getter，
        // 使得对象或数组的每一个成员都被依赖收集，形成一个“深（deep）”依赖关系
        traverse(value)
      }
      // 将观察者实例从target栈中取出并设置给Dep.target
      popTarget()
      // 清理依赖收集
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 调用Dep的addSub收集依赖
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 调用Dep的removeSub清理依赖
  cleanupDeps () {
    // 移除所有观察者对象
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 调度者接口，当依赖发生改变的时候进行回调。
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 同步则执行run直接渲染视图
      this.run()
    } else {
      // 异步推送到观察者队列中，下一个tick时调用。
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      // Dep.target = new Watch() -> 取值parsePath(expOrFn) -> 触发get进行依赖收集
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        // 保存旧值
        const oldValue = this.value
        // 存储新值
        this.value = value
        // 触发回调
        if (this.user) {
          try {
            // 回调传递新值和旧值
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 即便值相同，拥有Deep属性的观察者以及在对象／数组上的观察者应该被触发更新，
          // 因为它们的值可能发生改变。
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 获取观察者的值
  // 实际是脏检查，在计算属性中的依赖发生改变的时候dirty会变成true
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // 调用Dep的方法: 收集该watcher的所有deps依赖
  depend () {
    let i = this.deps.length
    while (i--) {
      // 调用Dep的方法: Dep.target.addDep(this)
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // 将自身从所有依赖收集订阅列表删除 (Vue.prototype.$watch封装: /core/instance/state.js)
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 从vm实例的观察者列表中将自身移除
      // 由于该操作比较耗费资源，所以如果vm实例正在被销毁则跳过该步骤。
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      // 将自身从所有依赖收集订阅列表删除
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 递归每一个对象或者数组，触发它们的getter，使得对象或数组的每一个成员都被依赖收集，形成一个“深（deep）”依赖关系
const seenObjects = new Set()
// 用来存放Oberser实例等id，避免重复读取
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}
// 递归
function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  // 不是数组且不是对象 或 是不可扩展对象直接return，不需要收集深层依赖关系
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  if (val.__ob__) {
    // 避免重复读取
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    // 将value对应的依赖添加进set集合
    seen.add(depId)
  }
  if (isA) { // 递归数组
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else { // 递归对象
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
