/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor (
    router: Router, /*router：VueRouter 实例 this*/
    base: ?string, /*base：VueRouter 实例 配置项 options.base*/
    fallback: boolean
  ) {
    /*继承 History 属性和方法*/
    super(router, base)
    // check history fallback deeplinking
    /*保证浏览器地址以 /# 开头*/
    if (fallback && checkFallback(this.base)) {
      return
    }
    /*hash 值确保是 '/' 开头*/
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    /*VueRouter 实例*/
    const router = this.router
    /*scrollBehavior*/
    const expectScroll = router.options.scrollBehavior
    /*supportsScroll*/
    const supportsScroll = supportsPushState && expectScroll
    /*支持滚动条定位：设置当前路劲 url 页面的滚动条的位置*/
    if (supportsScroll) {
      /*监听 popstate 事件：设置设置滚动条定位*/
      setupScroll()
    }

    /*监听事件*/
    window.addEventListener(supportsPushState ? 'popstate' : 'hashchange', () => {
      /*当前路由对象*/
      const current = this.current
      /*hash 值确保是 '/' 开头*/
      if (!ensureSlash()) {
        return
      }
      /*跳转路由*/
      this.transitionTo(getHash(), route => {
        /*支持滚动条定位*/
        if (supportsScroll) {
          /*处理滚动条定位*/
          handleScroll(this.router, route, current, true)
        }
        /*不支持 PushState*/
        if (!supportsPushState) {
          /*调用 replaceHash 方法*/
          replaceHash(route.fullPath)
        }
      })
    })
  }

  /*通过 pushHash 调用 transitionTo 跳转路由*/
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    /*当前路由对象*/
    const { current: fromRoute } = this
    /*路由跳转*/
    this.transitionTo(location, route => {
      /*向浏览器中 pushState*/
      pushHash(route.fullPath)
      /*处理滚动条定位*/
      handleScroll(this.router, route, fromRoute, false)
      /*回调完成*/
      onComplete && onComplete(route)
    }, onAbort)
  }

  /*通过 replaceHash 调用 transitionTo 跳转路由*/
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    /*当前路由对象*/
    const { current: fromRoute } = this
    /*路由跳转*/
    this.transitionTo(location, route => {
      /*向浏览器中 replaceState*/
      replaceHash(route.fullPath)
      /*处理滚动条定位*/
      handleScroll(this.router, route, fromRoute, false)
      /*回调完成*/
      onComplete && onComplete(route)
    }, onAbort)
  }

  go (n: number) {
    window.history.go(n)
  }

  /*跳转 url 路由：pushHash、replaceHash*/
  ensureURL (push?: boolean) {
    /*获取当前路由对象的 fullPath*/
    const current = this.current.fullPath
     /*一、获取浏览器 window 地址的 hash 值
       二、当前路由对象的 fullPath
       二者不相等
    */
    if (getHash() !== current) {
      /*跳转 url 路由：pushHash、replaceHash*/
      push ? pushHash(current) : replaceHash(current)
    }
  }

  /*获取浏览器 window 地址的 hash 值*/
  getCurrentLocation () {
    return getHash()
  }
}

/*获取浏览器 window 地址的 hash 值*/
export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  const href = window.location.href
  const index = href.indexOf('#')
  return index === -1 ? '' : decodeURI(href.slice(index + 1))
}

/*向浏览器中 pushState*/
function pushHash (path) {
  /*支持 pushState 的浏览器：利用 pushState 方法*/
  if (supportsPushState) {
    /*获取浏览器路径：path 为新的 hash*/
    pushState(getUrl(path))
  }
  /*不支持 pushState 的浏览器：直接利用 window.location.hash 修改浏览器的 hash 值*/
  else {
    window.location.hash = path
  }
}

/*向浏览器中 replaceState*/
function replaceHash (path) {
  /*支持 pushState 的浏览器：利用 replaceState 方法*/
  if (supportsPushState) {
    replaceState(getUrl(path))
  }
  /*不支持 pushState 的浏览器：window.location.replace*/
  else {
    window.location.replace(getUrl(path))
  }
}

/*获取浏览器路径：path 为新的 hash*/
function getUrl (path) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

/*hash 值确保是 '/' 开头*/
function ensureSlash (): boolean {
  /*获取浏览器 window 地址的 hash 值*/
  const path = getHash()
  /*hash 以 '/' 开头*/
  if (path.charAt(0) === '/') {
    return true
  }
  /*hash 不以 '/' 开头，向浏览器中 replaceHash*/
  replaceHash('/' + path)
  return false
}

/*保证浏览器地址以 /# 开头*/
function checkFallback (base) {
  /*根据 base 获取浏览器 window 地址location：pathname + search + hash*/ 
  const location = getLocation(base)
  /*不是以 /# 开头*/
  if (!/^\/#/.test(location)) {
    window.location.replace(
      cleanPath(base + '/#' + location)
    )
    return true
  }
}
