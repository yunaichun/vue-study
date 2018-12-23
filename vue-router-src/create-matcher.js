/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

/*根据传入的 routes 配置对象 创建路由映射表*/
export function createMatcher (
  routes: Array<RouteConfig>, /*routes 配置对象*/
  router: VueRouter /*VueRouter 实例*/
): Matcher {
  /*一、根据 routes 配置对象创建路由 map：
    pathList：存储所有路由配置的 path
    pathMap：path <=> 路由记录 映射表
    nameMap：name <=> 路由记录 映射表
  */
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  /*二、添加路由函数：根据 routes 配置对象创建路由 map（index.js 文件的 addRoutes 方法调用）*/
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  /*二、添加路由匹配（history/base.js 文件 transitionTo 方法调用）*/
  function match (
    /*1、参数一：根据 base 获取浏览器 window 地址location：pathname + search + hash（对 HTML5History 来说）
                 获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
                 非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说） 
      2、参数二：根路由 '/' 路由 url.parse 对象（根据 util/route.js 文件的 createRoute 方法创建）
      3、参数三：参数值与 参数一 类似
    */
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location
  ): Route {
    /*规范化处理 location：1、字符串 path 2、对象 query 3、字符串 hash*/
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location

    /*一、路由 url.parse 对象中含有 name*/
    if (name) {
      /*nameMap：name <=> 路由记录  映射表*/
      const record = nameMap[name]
      /*此 name 的 路由记录  映射表 不存在，报错，创建空路由*/
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      /* 路由映射表中不含有此 name 的路由：创建空路由*/
      if (!record) return _createRoute(null, location)

      /*路由映射表中的 key*/
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      /*规范化处理 location 中的 params*/
      if (typeof location.params !== 'object') {
        location.params = {}
      }

      /*规范化处理 location 中的 params 处理：混入 根路由 '/' 路由 url.parse 对象的 params 参数*/
      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }

      /* 路由映射表中含有此 name 的路由：创建路由*/
      if (record) {
        /*将动态路由解析成对象的形式：
          例：let toPath = Regexp.compile('/user/:id')
              toPath({ id: 123 }) //=> "/user/123"
        */
        location.path = fillParams(record.path, location.params, `named route "${name}"`)
        /*创建指定路由*/
        return _createRoute(record, location, redirectedFrom)
      }
    }
    /*二、路由 url.parse 对象中不含有 name，但是 path 存在*/
    else if (location.path) {
      location.params = {}
      /*遍历所有路由配置的 path*/
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        /*path <=> 路由记录 映射表*/
        const record = pathMap[path]
        /*匹配到指定 path 的路由后：创建指定路由*/
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }

    // no match
    /*三、路由 url.parse 对象中不含有 name，也不含有 path*/
    return _createRoute(null, location)
  }

  /*创建路由：分为两种情况*/
  function _createRoute (
    record: ?RouteRecord, /*路由映射表*/
    location: Location, /*规范化处理 location：1、字符串 path 2、对象 query 3、字符串 hash*/
    /*redirectedFrom 参数含义：与参数 2 类似
      1、根据 base 获取浏览器 window 地址location：pathname + search + hash（对 HTML5History 来说）
      2、获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
      3、非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说）
    */
    redirectedFrom?: Location 
  ): Route {
    /*一、路由映射表存在 redirect：重定向*/
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    /*二、路由映射表存在 matchAs：动态路由*/
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    /*三、路由映射表不存在 redirect 和 matchAs，创建路由*/
    return createRoute(record, location, redirectedFrom, router)
  }

  /*一、路由映射表存在 redirect：重定向*/
  function redirect (
    record: RouteRecord, /*路由映射表*/
    location: Location /*规范化处理 location：1、字符串 path 2、对象 query 3、字符串 hash*/
  ): Route {
    /*路由映射表：中最初的 redirect 重定向地址*/
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router)) /*如果 originalRedirect 为 function 创建路由对象*/
      : originalRedirect

    /*redirect 为 string 的话拼接为对象 */
    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    /*redirect 不为对象的话报错*/
    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      /*创建空路由*/
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    /*redirect 中 query、hash、params 处理*/
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    /*一、重定向路由 url.parse 对象中含有 name【即 name 改变了】*/
    if (name) {
      // resolved named direct
      /*nameMap：name <=> 路由记录  映射表*/
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        /*此 name 的 路由记录  映射表 不存在，报错*/
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      /*重定向：即重新调用 match 函数*/
      return match({
        _normalized: true,
        name, /*重定向的 name*/
        query,
        hash,
        params
      }, undefined, location)
    }
    /*二、重定向路由 url.parse 对象中不含有 name，但是 path 存在【即 path 改变了】*/
    else if (path) {
      // 1. resolve relative redirect
      /*当前 redirect 的 path 相对 路由映射表 record 的路径*/
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      /*将动态路由解析成对象的形式：
        例：let toPath = Regexp.compile('/user/:id')
            toPath({ id: 123 }) //=> "/user/123"
      */
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      /*重定向：即重新调用 match 函数*/
      return match({
        _normalized: true,
        path: resolvedPath, /*重定向的 path*/
        query,
        hash
      }, undefined, location)
    }
    /*三、重定向路由 url.parse 对象中不含有 name，也不含有 path【即 name 和 path 都没改变】*/
    else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      /*创建空路由*/
      return _createRoute(null, location)
    }
  }

  /*二、路由映射表存在 matchAs：动态路由*/
  function alias (
    record: RouteRecord, /*路由映射表*/
    location: Location, /*规范化处理 location：1、字符串 path 2、对象 query 3、字符串 hash*/
    matchAs: string /*路由映射表中的 matchAs*/
  ): Route {
    /*将动态路由解析成对象的形式：
      例：let toPath = Regexp.compile('/user/:id')
          toPath({ id: 123 }) //=> "/user/123"
    */
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    /*重新构建路由匹配*/
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    /*如果路由匹配对象存在：创建路由*/
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      /*创建 matchAs 路由*/
      return _createRoute(aliasedRecord, location)
    }
    /*如果路由匹配对象不存在：创建 matchAs 空路由*/
    return _createRoute(null, location)
  }

  /*最后：返回 matcher 对象*/
  return {
    match,
    addRoutes
  }
}

/*是否匹配上指定的路由*/
function matchRoute (
  regex: RouteRegExp,/* 路由映射表中 regex 属性*/
  path: string, /*规范化处理 location（1、字符串 path 2、对象 query 3、字符串 hash）中的 path*/
  params: Object /*规范化处理 location（1、字符串 path 2、对象 query 3、字符串 hash）中的 params*/
): boolean {
  /*path 是否匹配上 regex*/
  const m = path.match(regex)

  /*path 没有匹配上 regex*/
  if (!m) {
    return false
  }
  /*path 匹配上 regex，同时没有传动态路由*/
  else if (!params) {
    return true
  }

  /*path 匹配上 regex，传动态路由：遍历匹配项*/
  for (let i = 1, len = m.length; i < len; ++i) {
    /*匹配的 key*/
    const key = regex.keys[i - 1]
    /*匹配的 value*/
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    /*匹配的 key 存在*/
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

/*处理当前 redirect 的 path 相对 路由映射表 record 的路径*/
function resolveRecordPath (path: string, record: RouteRecord): string {
  /*相对路径、基础路径、相对路径是否拼接到基础路径之后
    1、resolvePath('/aaa', '/bbb', false)   ->   "/aaa"
    2、resolvePath('?aaa', '/bbb', false)   ->   "/bbb?aaa"
    3、resolvePath('aaa', '/bbb', true)   ->   "/bbb/aaa"
      resolvePath('aaa', '/bbb', false)   ->   "/aaa"
  */
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
