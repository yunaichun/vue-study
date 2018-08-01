/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  // 添加一个观察者
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 移除一个观察者(splice)
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 在Watcher对象中通过depend方法调用
  // 会收集该watcher的所有deps依赖
  depend () {
    // new Watch() -> Dep.target = new Watch() -> 取值parsePath(expOrFn) -> 触发get进行依赖收集
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 通知所有观察
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// 依赖收集完需要将Dep.target设为null，防止后面重复添加依赖
Dep.target = null
const targetStack = []

// 将watcher观察者实例设置给Dep.target，用以依赖收集。
// 同时将该实例存入target栈中
export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target // _target是一个Watch实例
}

// 将观察者实例从target栈中取出并设置给Dep.target
export function popTarget () {
  Dep.target = targetStack.pop()
}
