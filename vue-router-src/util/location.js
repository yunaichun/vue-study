/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

/*规范化处理 location*/
export function normalizeLocation (
  /*1、参数一：根据 base 获取浏览器 window 地址 location：pathname + search + hash（对 HTML5History 来说）
               获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
               非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说） 
    2、参数二：根路由 '/' 路由 url.parse 对象（根据 util/route.js 文件的 createRoute 方法创建）
    3、参数三：是否 append
    4、参数四：VueRouter 实例
  */
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  /*浏览器地址*/
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  /*一、浏览器地址有 name 或 _normalized 属性直接返回*/
  if (next.name || next._normalized) {
    return next
  }

  // relative params
  /*二、浏览器地址：没有 path、有 params、根路由 '/' 路由 url.parse 对象*/
  if (!next.path && next.params && current) {
    /*浏览器地址对象拷贝*/
    next = extend({}, next)
    /*浏览器地址标记 _normalized 属性*/
    next._normalized = true
    /*将 location 中的 params 混入到 根路由 '/' 路由 url.parse 对象*/
    const params: any = extend(extend({}, current.params), next.params)

    /*根路由 '/' 路由 url.parse 对象中含有 name：更新浏览器地址的 name 和 params*/
    if (current.name) {
      next.name = current.name
      next.params = params
    }
    /*根路由 '/' 路由 url.parse 对象中 matched 有数组：更新浏览器地址的 path*/
    else if (current.matched.length) {
      /*将动态路由解析成对象的形式：
        例：let toPath = Regexp.compile('/user/:id')
            toPath({ id: 123 }) //=> "/user/123"
      */
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    }
    /*否则报错*/
    else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    /*返回更新后的浏览器地址对象配置*/
    return next
  }

  /*三、其余情况*/
  /*相对路径：返回 url 的 Path 中解析出的 path、query、hash*/
  const parsedPath = parsePath(next.path || '')
  /*基础路径：根路由 '/' 路由 url.parse 对象*/
  const basePath = (current && current.path) || '/'
  /*最终解析的 path*/
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    _normalized: true,
    path,
    query,
    hash
  }
}
