/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

export default class VueRouter {
  static install: () => void;
  static version: string;

  app: any;
  apps: Array<any>;
  ready: boolean;
  readyCbs: Array<Function>;
  options: RouterOptions;
  mode: string;
  history: HashHistory | HTML5History | AbstractHistory;
  matcher: Matcher;
  fallback: boolean;
  beforeHooks: Array<?NavigationGuard>;
  resolveHooks: Array<?NavigationGuard>;
  afterHooks: Array<?AfterNavigationHook>;

  constructor (options: RouterOptions = {}) {
    this.app = null
    this.apps = []
    this.options = options
    this.beforeHooks = []
    this.resolveHooks = []
    this.afterHooks = []
    /*一、创建路由 match 匹配函数：1、addRoutes 函数 - 添加路由函数：根据 routes 配置对象创建路由 map、2、match 函数 - 添加路由匹配*/
    this.matcher = createMatcher(options.routes || [], this)

    /*根据 mode 采取不同的路由方式*/
    let mode = options.mode || 'hash'
    /*https://github.com/vuejs/vue-router/releases/tag/v2.6.0
      1、options.fallback 是2.6.0 新增, 表示是否对不支持 HTML5 history 的浏览器采用降级处理
      2、options.mode = 'history' && 非浏览器/浏览器不支持 'pushState' && options.fallback = true/undefined
    */
    this.fallback = mode === 'history' && !supportsPushState && options.fallback !== false
    /*兼容不支持 history 的浏览器*/
    if (this.fallback) {
      mode = 'hash'
    }
    /*非浏览器环境*/
    if (!inBrowser) {
      mode = 'abstract'
    }
    this.mode = mode

    /*二、根据 mode 创建 history 实例*/
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  /*install 方法会调用此 init 方法，传入的是 Vue 实例*/
  init (app: any /* Vue component instance */) {
    /*install 方法被调用了，即先使用 Vue.use(VueRouter) 了*/
    process.env.NODE_ENV !== 'production' && assert(
      install.installed,
      `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
      `before creating root instance.`
    )
    this.apps.push(app)
    /*app 是否已经初始化，初始化过后不再往下执行（保证此函数只会调用一次）*/
    // main app already initialized.
    if (this.app) {
      return
    }
    /*实例赋值，当前 Vue 实例*/
    this.app = app

    const history = this.history
    /*transitionTo函数：跳转路由封装*/
    if (history instanceof HTML5History) {
      /*case 'history': 调用 history 实例的 transitionTo 方法、传入 history.getCurrentLocation()*/
      history.transitionTo(history.getCurrentLocation())
    }
    /*transitionTo函数：跳转路由封装（通过给 popstate 或 hashchange 添加监听）*/
    else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        /*设置 popstate、hashchange 事件监听*/
        history.setupListeners()
      }
      /*case 'hash': 调用 history 实例的 transitionTo 方法、传入 history.getCurrentLocation() + history.setupListeners()*/
      history.transitionTo(
        history.getCurrentLocation(),
        setupHashListener, /*成功事件*/
        setupHashListener /*失败事件*/
      )
    }
    /*history 的 listen 监听函数*/
    history.listen(route => {
      this.apps.forEach((app) => {
        /*实例化的 route 定义在 Vue 的 _route 属性下*/
        app._route = route
      })
    })
  }

  /*match 方法即为 createMatcher 方法返回的 match 方法*/
  match (
    /*1、参数一：根据 base 获取浏览器 window 地址location：pathname + search + hash（对 HTML5History 来说）
                 获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
                 非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说） 
      2、参数二：根路由 '/' 路由 url.parse 对象（根据 util/route.js 文件的 createRoute 方法创建）
      3、参数三：参数值与 参数一 类似
    */
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ): Route {
    return this.matcher.match(raw, current, redirectedFrom)
  }

  /*获取当前路由对象*/
  get currentRoute (): ?Route {
    return this.history && this.history.current
  }
  
  /*注册 beforeHooks 事件*/
  beforeEach (fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }

  /*注册 resolveHooks 事件*/
  beforeResolve (fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  /*注册 afterHooks 事件*/
  afterEach (fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }

  /*onReady 事件*/
  onReady (cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }

  /*onError 事件*/
  onError (errorCb: Function) {
    this.history.onError(errorCb)
  }

  /*调用 transitionTo 跳转路由*/
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.push(location, onComplete, onAbort)
  }

  /*调用 transitionTo 跳转路由*/
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    this.history.replace(location, onComplete, onAbort)
  }

  /*跳转到指定历史记录*/
  go (n: number) {
    this.history.go(n)
  }

  /*后退*/
  back () {
    this.go(-1)
  }

  /*前进*/
  forward () {
    this.go(1)
  }

  /*获取路由匹配的组件*/
  getMatchedComponents (to?: RawLocation | Route): Array<any> {
    const route: any = to
      ? to.matched
        ? to
        : this.resolve(to).route
      : this.currentRoute
    /*没有匹配的路由，返回空数组*/
    if (!route) {
      return []
    }
    /*返回路由匹配的 components*/
    return [].concat.apply([], route.matched.map(m => {
      return Object.keys(m.components).map(key => {
        return m.components[key]
      })
    }))
  }

  /*根据路由对象返回浏览器路径等信息*/
  resolve (
    to: RawLocation, /*要跳转至的路由*/
    current?: Route, /*当前路由*/
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    /*规范化处理 location*/
    const location = normalizeLocation(
      to,
      current || this.history.current,
      append,
      this
    )
    /*根据 location 匹配的路由对象*/
    const route = this.match(location, current)
    /*匹配的路由对象的 fullPath*/
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    /*创建页面 href 链接*/
    const href = createHref(base, fullPath, this.mode)
    return {
      location, /*规范化处理 location*/
      route, /*根据 location 匹配的路由对象*/
      href, /*创建页面 href 链接*/
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  /*添加路由函数：根据 routes 配置对象创建路由 map*/
  addRoutes (routes: Array<RouteConfig>) {
    /*添加路由函数*/
    this.matcher.addRoutes(routes)
    /*如果当前路由对象不是根路由*/
    if (this.history.current !== START) {
      /*跳转路由*/
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

/*注册指定钩子函数*/
function registerHook (list: Array<any>, fn: Function): Function {
  /*将 fn 存入 list 数组 */
  list.push(fn)
  /*返回一个函数*/
  return () => {
    /*又将此 fn 抽出来了*/
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

/*创建页面 href 链接*/
function createHref (base: string, fullPath: string, mode) {
  /*fullPath 的 hash 值*/
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  /*加上 base 的全部路径*/
  return base ? cleanPath(base + '/' + path) : path
}

/*装载 install 方法和 version 版本*/
VueRouter.install = install
VueRouter.version = '__VERSION__'

/*自动装载 VueRouter 实例*/
if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
