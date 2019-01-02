/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return
    }
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    window.addEventListener(supportsPushState ? 'popstate' : 'hashchange', () => {
      const current = this.current
      if (!ensureSlash()) {
        return
      }
      this.transitionTo(getHash(), route => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true)
        }
        if (!supportsPushState) {
          replaceHash(route.fullPath)
        }
      })
    })
  }

  /*通过 pushHash 调用 transitionTo 跳转路由*/
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      pushHash(route.fullPath)
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }

  /*通过 replaceHash 调用 transitionTo 跳转路由*/
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceHash(route.fullPath)
      handleScroll(this.router, route, fromRoute, false)
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

/*向浏览器中 replaceHash*/
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

function checkFallback (base) {
  const location = getLocation(base)
  if (!/^\/#/.test(location)) {
    window.location.replace(
      cleanPath(base + '/#' + location)
    )
    return true
  }
}

function ensureSlash (): boolean {
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }
  replaceHash('/' + path)
  return false
}
