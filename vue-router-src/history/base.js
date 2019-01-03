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

  constructor (
    router: Router, /*router：VueRouter 实例 this*/
    base: ?string /*base：VueRouter 实例 配置项 options.base*/
  ) {
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

  /*跳转路由封装*/
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
      /*更新路由：route 是 VueRouter 实例*/
      this.updateRoute(route)
      /*执行 onComplete 函数*/
      onComplete && onComplete(route)
      /*利用浏览器：window.history.replaceState*/
      this.ensureURL()

      // fire ready cbs once
      /*执行 readyCbs 回调函数*/
      if (!this.ready) {
        this.ready = true
        this.readyCbs.forEach(cb => { cb(route) })
      }
    }, err => {
      if (onAbort) {
        onAbort(err)
      }
      /*执行 readyErrorCbs 回调函数*/
      if (err && !this.ready) {
        this.ready = true
        this.readyErrorCbs.forEach(cb => { cb(err) })
      }
    })
  }

  /* 确认跳转：
    1、参数一：匹配的路由
    2、参数二：匹配成功的回调
    3、参数三：匹配失败的回调 
  */
  confirmTransition (
    route: Route, /*匹配的路由对象*/
    onComplete: Function, /*成功回调函数*/
    onAbort?: Function /*失败回调函数*/
  ) {
    /*当前的路由对象*/
    const current = this.current
    /*对 onAbort 的封装*/
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

    /*一、匹配的路由和当前的路由对象相同不跳转*/
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      /*利用浏览器：window.history.replaceState*/
      this.ensureURL()
      return abort()
    }

    /*根据当前路由对象和匹配的路由：返回更新的路由、停用的路由、激活的路由*/
    const {
      updated,
      deactivated,
      activated
    } = resolveQueue(this.current.matched, route.matched)

    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      /*1、停用的路由：beforeRouteLeave 钩子函数调用*/
      extractLeaveGuards(deactivated),
      // global before hooks
      /*2、beforeHooks*/
      this.router.beforeHooks,
      // in-component update hooks
      /*3、更新的路由：beforeRouteUpdate 钩子函数调用*/
      extractUpdateHooks(updated),
      // in-config enter guards
      /*4、激活的路由：beforeEnter 钩子函数调用*/
      activated.map(m => m.beforeEnter),
      // async components
      /*5、处理异步激活的路由组件*/
      resolveAsyncComponents(activated)
    )

    this.pending = route
    /*遍历器对象*/
    const iterator = (hook: NavigationGuard, next) => {
      if (this.pending !== route) {
        return abort()
      }
      try {
        hook(route, current, (to: any) => {
          /*没有正确到达的路由 to */
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            /*利用浏览器：window.history.pushState*/
            this.ensureURL(true)
            abort(to)
          }
          /*有正确到达的路由 to */
          else if (
            typeof to === 'string' ||
            (typeof to === 'object' && (
              typeof to.path === 'string' ||
              typeof to.name === 'string'
            ))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            /*正确到达的路由 to 有 replace：*/
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            }
            /*正确到达的路由 to 没有 replace：*/
            else {
              this.push(to)
            }
          }
          /*其他情况：next 下一个*/
          else {
            // confirm transition and pass on the value
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    /*自动执行异步任务队列*/
    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      /*激活的路由：beforeRouteEnter 钩子函数调用*/
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      /*resolveHooks*/
      const queue = enterGuards.concat(this.router.resolveHooks)
      /*再一次自动执行异步任务队列*/
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        /*完成事件*/
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

/*根据当前路由对象和匹配的路由：返回更新的路由、激活的路由、停用的路由*/
function resolveQueue (
  current: Array<RouteRecord>, /*当前的路由对象的matched*/
  next: Array<RouteRecord> /*匹配的路由的matched*/
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  /*找到当前路由改变的 index*/
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i), /*更新的路由*/
    activated: next.slice(i), /*激活的路由*/
    deactivated: current.slice(i) /*停用的路由*/
  }
}

/*instance 调用 guard 函数*/
function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  /*是 Vue 的实例*/
  if (instance) {
    return function boundRouteGuard () {
      /*instance 调用 guard 函数*/
      return guard.apply(instance, arguments)
    }
  }
}

/*提取指定 name 的路由钩子函数*/
function extractGuards (
  records: Array<RouteRecord>, /*停用的路由*/
  name: string, /*beforeRouteLeave*/
  bind: Function, /*bindGuard 函数*/
  reverse?: boolean /*是否 reverse*/
): Array<?Function> {
  /*返回 停用的路由 map 出的新路由，map 的函数是 fn*/
  const guards = flatMapComponents(records,
    /*records[i].components[key]、records[i].instances[key]、records[i]、i*/
    (def, instance, match, key) => {
      /*返回 key 路由 对应的组件*/
      const guard = extractGuard(def, name)
      /*组件存在的话*/
      if (guard) {
        return Array.isArray(guard)
          ? guard.map(guard => bind(guard, instance, match, key))
          : bind(guard, instance, match, key) /*instance 调用 guard 函数*/
      }
    }
  )
  /*返回新的数组：原数组、逆向数组*/
  return flatten(reverse ? guards.reverse() : guards)
}

/*提取指定 key 的路由钩子函数*/
function extractGuard (
  def: Object | Function, /*records[i]*/
  key: string /*beforeRouteLeave*/
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  /*返回组件*/
  return def.options[key]
}


/*1、停用的路由：beforeRouteLeave 钩子函数调用*/
function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

/*2、更新的路由：beforeRouteUpdate 钩子函数调用*/
function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

/*3、激活的路由：beforeRouteEnter 钩子函数调用*/
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
