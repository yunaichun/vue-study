/* @flow */

import type Router from '../index'
import { assert } from './warn'
import { getStateKey, setStateKey } from './push-state'

/*存储页面所有路径 url 滚动条的位置*/
const positionStore = Object.create(null)

/*设置滚动条定位*/
export function setupScroll () {
  // Fix for #1585 for Firefox
  // Fix for #2195 Add optional third attribute to workaround a bug in safari https://bugs.webkit.org/show_bug.cgi?id=182678
  window.history.replaceState({ key: getStateKey() }, '', window.location.href.replace(window.location.origin, ''))
  /*监听 popstate 事件*/
  window.addEventListener('popstate', e => {
    saveScrollPosition()
    if (e.state && e.state.key) {
      setStateKey(e.state.key)
    }
  })
}

/*保存当前滚动条位置*/
export function saveScrollPosition () {
  const key = getStateKey()
  if (key) {
    /*存储当前路径 url 滚动条的位置*/
    positionStore[key] = {
      x: window.pageXOffset,
      y: window.pageYOffset
    }
  }
}

/*处理滚动条定位*/
export function handleScroll (
  router: Router, /*路由实例*/
  to: Route, /*跳转至哪里的路由*/
  from: Route, /*当前路由*/
  isPop: boolean
) {
  /*路由实例没有 app*/
  if (!router.app) {
    return
  }

  /*options 中没有 scrollBehavior 选项配置，直接返回*/
  const behavior = router.options.scrollBehavior
  if (!behavior) {
    return
  }

  if (process.env.NODE_ENV !== 'production') {
    assert(typeof behavior === 'function', `scrollBehavior must be a function`)
  }

  // wait until re-render finishes before scrolling
  router.app.$nextTick(() => {
    /*获取当前页面滚动条的位置*/
    const position = getScrollPosition()
    /*滚动条是否需要滚动*/
    const shouldScroll = behavior.call(router, to, from, isPop ? position : null)
    if (!shouldScroll) {
      return
    }

    if (typeof shouldScroll.then === 'function') {
      /*滚动条滚动到指定位置*/
      shouldScroll.then(shouldScroll => {
        scrollToPosition((shouldScroll: any), position)
      }).catch(err => {
        if (process.env.NODE_ENV !== 'production') {
          assert(false, err.toString())
        }
      })
    } else {
      /*滚动条滚动到指定位置*/
      scrollToPosition(shouldScroll, position)
    }
  })
}

/*获取当前页面滚动条的位置*/
function getScrollPosition (): ?Object {
  const key = getStateKey()
  if (key) {
    return positionStore[key]
  }
}

/*滚动条滚动到指定位置*/
function scrollToPosition (shouldScroll, position) {
  const isObject = typeof shouldScroll === 'object'
  /*shouldScroll 是对象、shouldScroll.selector 是字符串*/
  if (isObject && typeof shouldScroll.selector === 'string') {
    /*获取元素*/
    const el = document.querySelector(shouldScroll.selector)
    /*元素存在*/
    if (el) {
      /*偏移量*/
      let offset = shouldScroll.offset && typeof shouldScroll.offset === 'object' ? shouldScroll.offset : {}
      /*规范化偏移量offset*/
      offset = normalizeOffset(offset)
      /*获取元素的 position*/
      position = getElementPosition(el, offset)
    }
    /*元素不存在*/
    else if (isValidPosition(shouldScroll)) {
      /*规范化位置position*/
      position = normalizePosition(shouldScroll)
    }
  }
  /*shouldScroll 是对象、滚动条位置是正确的位置*/
  else if (isObject && isValidPosition(shouldScroll)) {
    /*规范化位置position*/
    position = normalizePosition(shouldScroll)
  }

  /*滚动到指定的位置*/
  if (position) {
    window.scrollTo(position.x, position.y)
  }
}

/*滚动条位置是正确的位置*/
function isValidPosition (obj: Object): boolean {
  return isNumber(obj.x) || isNumber(obj.y)
}

/*规范化偏移量offset*/
function normalizeOffset (obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : 0,
    y: isNumber(obj.y) ? obj.y : 0
  }
}

/*获取元素的 position*/
function getElementPosition (el: Element, offset: Object): Object {
  const docEl: any = document.documentElement
  const docRect = docEl.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  return {
    x: elRect.left - docRect.left - offset.x,
    y: elRect.top - docRect.top - offset.y
  }
}

/*规范化位置position*/
function normalizePosition (obj: Object): Object {
  return {
    x: isNumber(obj.x) ? obj.x : window.pageXOffset,
    y: isNumber(obj.y) ? obj.y : window.pageYOffset
  }
}

/*是否是 number 类型*/
function isNumber (v: any): boolean {
  return typeof v === 'number'
}
