/* @flow */

import type Router from '../index'
import { History } from './base'

export class AbstractHistory extends History {
  index: number;
  stack: Array<Route>;

  constructor (
    router: Router, /*router：VueRouter 实例 this*/
    base: ?string /*base：VueRouter 实例 配置项 options.base*/
  ) {
    /*继承 History 属性和方法*/
    super(router, base)
    this.stack = []
    this.index = -1
  }

  go (n: number) {
    const targetIndex = this.index + n
    if (targetIndex < 0 || targetIndex >= this.stack.length) {
      return
    }
    const route = this.stack[targetIndex]
    this.confirmTransition(route, () => {
      this.index = targetIndex
      this.updateRoute(route)
    })
  }

  /*非浏览器环境获取 stack 数组最后一项的 fullPath*/
  getCurrentLocation () {
    const current = this.stack[this.stack.length - 1]
    return current ? current.fullPath : '/'
  }

  /*通过 stack 调用 transitionTo 跳转路由*/
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.transitionTo(location, route => {
      this.stack = this.stack.slice(0, this.index + 1).concat(route)
      this.index++
      onComplete && onComplete(route)
    }, onAbort)
  }

  /*通过 stack 调用 transitionTo 跳转路由*/
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.transitionTo(location, route => {
      this.stack = this.stack.slice(0, this.index).concat(route)
      onComplete && onComplete(route)
    }, onAbort)
  }

  ensureURL () {
    // noop
  }
}
