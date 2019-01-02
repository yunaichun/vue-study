/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  /*router：VueRouter 实例 this*/
  /*base：VueRouter 实例 配置项 options.base*/
  constructor (router: Router, base: ?string) {
    /*继承 History 属性和方法*/
    super(router, base)

    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    const initLocation = getLocation(this.base)
    window.addEventListener('popstate', e => {
      const current = this.current

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.current === START && location === initLocation) {
        return
      }

      this.transitionTo(location, route => {
        if (supportsScroll) {
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  go (n: number) {
    window.history.go(n)
  }

  /*通过 pushState 调用 transitionTo 跳转路由*/
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      pushState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  /*通过 replaceState 调用 transitionTo 跳转路由*/
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  /*跳转 url 路由：pushState、replaceState*/
  ensureURL (push?: boolean) {
    /*一、根据 base 获取浏览器 window 地址location：pathname + search + hash
      二、当前路由对象的 fullPath
      二者不相等
    */ 
    if (getLocation(this.base) !== this.current.fullPath) {
      /*将当前路由对象的 fullPath 中的双斜杠 替换成 一个斜杠*/
      const current = cleanPath(this.base + this.current.fullPath)
      /*跳转 url 路由：window.history.pushState、window.history.replaceState*/
      push ? pushState(current) : replaceState(current)
    }
  }

  /*根据 base 获取浏览器 window 地址location：pathname + search + hash*/ 
  getCurrentLocation (): string {
    return getLocation(this.base)
  }
}

/*根据 base 获取浏览器 window 地址location：pathname + search + hash*/ 
export function getLocation (base: string): string {
  /*解码 window.location.pathname*/ 
  let path = decodeURI(window.location.pathname)
  /*base 存在并且 base 在 path 中的位置是第一位*/
  if (base && path.indexOf(base) === 0) {
    /*去除掉 path 中的 base*/
    path = path.slice(base.length)
  }
  /*pathname + search + hash*/
  return (path || '/') + window.location.search + window.location.hash
}
