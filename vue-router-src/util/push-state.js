/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'

// use User Timing api (if present) for more accurate key precision
const Time = inBrowser && window.performance && window.performance.now
  ? window.performance
  : Date

/*获取当前路径对应的 key，可以在 popstate 监听事件中拿到*/
export function getStateKey () {
  return _key
}

/*获取当前路径对应的 key*/
export function setStateKey (key: string) {
  _key = key
}

/*根据时间生成的唯一的 key 值*/
let _key: string = genKey()
function genKey (): string {
  return Time.now().toFixed(3)
}

/*向浏览器中 pushState*/
export function pushState (url?: string, replace?: boolean) {
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    /*存在 replace*/
    if (replace) {
      /*原来是利用 window.history 的 replaceState*/
      history.replaceState({ key: _key }, '', url)
    } else {
      _key = genKey()
      /*原来是利用 window.history 的 pushState*/
      history.pushState({ key: _key }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

/*向浏览器中 replaceState*/
export function replaceState (url?: string) {
  pushState(url, true)
}

/*浏览器是否支持 pushState 方法*/
export const supportsPushState = inBrowser && (function () {
  const ua = window.navigator.userAgent
  /*Mobile Safari、Android 2.x 或 4.0不支持 pushState*/
  if (
    (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) && // 是 Android 2.x 或 4.0
    ua.indexOf('Mobile Safari') !== -1 && // 是 Mobile Safari
    ua.indexOf('Chrome') === -1 && // 不是 Chrome
    ua.indexOf('Windows Phone') === -1 // 不是 Windows Phone
  ) {
    return false
  }

  /*其余浏览器支持 pushState*/
  return window.history && 'pushState' in window.history
})()