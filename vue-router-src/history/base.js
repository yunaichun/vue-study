/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'

export class History {
  router: Router; /*VueRouter 实例 this*/
  base: string; /*VueRouter 实例 配置项 options.base*/
  current: Route;
  pending: ?Route;
  cb: (r: Route) => void;
  ready: boolean;
  readyCbs: Array<Function>;
  readyErrorCbs: Array<Function>;
  errorCbs: Array<Function>;

  // implemented by sub-classes
  +go: (n: number) => void;
  +push: (loc: RawLocation) => void;
  +replace: (loc: RawLocation) => void;
  +ensureURL: (push?: boolean) => void;
  +getCurrentLocation: () => string;

  constructor (router: Router, base: ?string) {
    /*保存 VueRouter 实例*/
    this.router = router
    /*规范化 VueRouter 传入参数 options.base*/
    this.base = normalizeBase(base)
    // start with a route object that stands for "nowhere"
    /*根路由 '/' 路由 url.parse 对象（根据 util/route.js 文件的 createRoute 方法创建）*/
    this.current = START
    this.pending = null
    /*onReady 事件相关参数*/
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    /*onError 事件相关参数*/
    this.errorCbs = []
  }

  /*listen 监听函数*/
  listen (cb: Function) {
    this.cb = cb
  }

  /*onReady 事件*/
  onReady (cb: Function, errorCb: ?Function) {
    /*this.ready 状态为 true，执行 cb 回调，否则 cb 暂时存储 不执行*/
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  /*onError 事件*/
  onError (errorCb: Function) {
    this.errorCbs.push(errorCb)
  }
 
  transitionTo (
    /*location 参数含义：
      根据 base 获取浏览器 window 地址location：pathname + search + hash（对 HTML5History 来说）
      获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
      非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说）
    */
    location: RawLocation,
    onComplete?: Function, /*成功回调函数*/
    onAbort?: Function /*失败回调函数*/
  ) {
    /* 添加路由匹配
      1、参数一：根据 base 获取浏览器 window 地址location：pathname + search + hash（对 HTML5History 来说）
                 获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
                 非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说） 
      2、参数二：根路由 '/' 路由 url.parse 对象（根据 util/route.js 文件的 createRoute 方法创建）
    */
    const route = this.router.match(location, this.current)
    this.confirmTransition(route, () => {
      this.updateRoute(route)
      onComplete && onComplete(route)
      this.ensureURL()

      // fire ready cbs once
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => { cb(route) })
      }
    }, err => {
      if (onAbort) {
        onAbort(err)
      }
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach(cb => { cb(err) })
      }
    })
  }

  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    const current = this.current
    const abort = err => {
      if (isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => { cb(err) })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort()
    }

    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)

    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      extractLeaveGuards(deactivated),
      // global before hooks
      this.router.beforeHooks,
      // in-component update hooks
      extractUpdateHooks(updated),
      // in-config enter guards
      activated.map(m => m.beforeEnter),
      // async components
      resolveAsyncComponents(activated)
    )

    this.pending = route
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            this.ensureURL(true)
            abort(to)
          } else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      const queue = enterGuards.concat(this.router.resolveHooks)
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        onComplete(route)
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => { cb() })
          })
        }
      })
    })
  }
  
  /*更新路由：route 是 VueRouter 实例*/
  updateRoute (route: Route) {
    /*缓存之前 VueRouter 实例*/
    const prev = this.current
    /*设置当前 VueRouter 实例*/
    this.current = route
    /*执行 listen 监听函数*/
    this.cb && this.cb(route)
    /*执行 afterHooks 钩子函数，传入当前 route 和之前 route 信息*/
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev)
    })
  }
}

/*规范化 VueRouter 传入参数 options.base*/
function normalizeBase (base: ?string): string {
  /*base 为 false 或 undefined*/
  if (!base) {
    /*浏览器环境*/
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      /*base 标签的 href 属性 或 '/'*/
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      /*https://baidu.com 转为空字符串*/
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    }
    /*非浏览器环境*/
    else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  /*保证开始字符是'/'*/
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
  /*保证结尾字符不是'/'*/
  return base.replace(/\/$/, '')
}

function resolveQueue (
  current: Array<RouteRecord>,
  next: Array<RouteRecord>
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),
    activated: next.slice(i),
    deactivated: current.slice(i)
  }
}

function extractGuards (
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    const guard = extractGuard(def, name)
    if (guard) {
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  return flatten(reverse ? guards.reverse() : guards)
}

function extractGuard (
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  return def.options[key]
}

function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

function extractEnterGuards (
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  return extractGuards(activated, 'beforeRouteEnter', (guard, _, match, key) => {
    return bindEnterGuard(guard, match, key, cbs, isValid)
  })
}

function bindEnterGuard (
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, cb => {
      next(cb)
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid)
        })
      }
    })
  }
}

function poll (
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    cb(instances[key])
  } else if (isValid()) {
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
