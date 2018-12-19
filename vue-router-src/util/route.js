/* @flow */

import type VueRouter from '../index'
import { stringifyQuery } from './query'

const trailingSlashRE = /\/?$/

// the starting route that represents the initial state
/*根路由 '/' 路由 url.parse 对象*/
export const START = createRoute(null, {
  path: '/'
})
/*创建路由 url.parse 对象：
  一、location 地址的 query 参数的克隆
  二、配置 route 对象：根据参数组装成 url.parse 对象
  三、存在 redirectedFrom 参数：添加至 route 对象
*/
export function createRoute (
  record: ?RouteRecord,
  /*1、根据 base 获取浏览器 window 地址location：pathname + search + hash（对 HTML5History 来说）
    2、获取浏览器 window 地址的 hash 值（对 HashHistory 来说） 
    3、非浏览器环境获取 stack 数组最后一项的 fullPath（对 AbstractHistory 来说）
  */
  location: Location,
  redirectedFrom?: ?Location, /*从哪里跳转过来的：参数值与 location 类似*/
  router?: VueRouter /*VueRouter 实例 this*/
): Route {
  /*VueRouter 配置对象的 stringifyQuery*/
  const stringifyQuery = router && router.options.stringifyQuery

  /*location 地址的 query 参数*/
  let query: any = location.query || {}
  /*一、location 地址的 query 参数的克隆*/
  try {
    query = clone(query)
  } catch (e) {}

  /*二、配置 route 对象：根据参数组装成 url.parse 对象*/
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery), /*获取完成的 location 路径：包含 query 参数的 stringifyQuery*/
    matched: record ? formatMatch(record) : [] /*格式化 match：不断找 record 的 parent 属性*/
  }
  /*三、存在 redirectedFrom 参数：添加至 route 对象*/
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  /*Object.freeze()阻止修改现有属性的特性和值，并阻止添加新属性：可以利用这个方法将对象彻底冻结，使其符合const变量的含义*/
  return Object.freeze(route)
}

/*location 的 query 查询参数的克隆操作：
  例：value = { foo: [1, 2], bar: { a: 1, b: 2 }, test: 2 }
  最终返回：value = { foo: [1, 2], bar: { a: 1, b: 2 }, test: 2 }
*/
function clone (value) {
  /*查询参数 query 是数组*/
  if (Array.isArray(value)) {
    /*循环遍历每一项*/
    return value.map(clone)
  }
  /*查询参数是对象*/
  else if (value && typeof value === 'object') {
    const res = {}
    /*循环遍历每一项*/
    for (const key in value) {
      res[key] = clone(value[key])
    }
    return res
  }
  /*查询参数是普通值*/
  else {
    return value
  }
}

/*获取完成的 location 路径：包含 query 参数的 stringifyQuery
  例：query = { foo: [1, 2], bar: { a: 1, b: 2 }, test: 2 };
      stringify(query) => "?foo=1&foo=2&bar=%5Bobject%20Object%5D&test=2"
*/
function getFullPath (
  { path, query = {}, hash = '' }, /*location：name + path + hash + params*/
  _stringifyQuery /*VueRouter 配置对象的 stringifyQuery*/
): string {
  /*query 参数的 stringify：变为*/
  const stringify = _stringifyQuery || stringifyQuery
  /*返回 path + query + hash*/
  return (path || '/') + stringify(query) + hash
}

/*格式化 match：不断找 record 的 parent 属性*/
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    res.unshift(record)
    /*不断找其 parent 属性*/
    record = record.parent
  }
  /*将传入的参数 丢进栈*/
  return res
}

export function isSameRoute (a: Route, b: ?Route): boolean {
  if (b === START) {
    return a === b
  } else if (!b) {
    return false
  } else if (a.path && b.path) {
    return (
      a.path.replace(trailingSlashRE, '') === b.path.replace(trailingSlashRE, '') &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query)
    )
  } else if (a.name && b.name) {
    return (
      a.name === b.name &&
      a.hash === b.hash &&
      isObjectEqual(a.query, b.query) &&
      isObjectEqual(a.params, b.params)
    )
  } else {
    return false
  }
}

function isObjectEqual (a = {}, b = {}): boolean {
  // handle null value #1566
  if (!a || !b) return a === b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => {
    const aVal = a[key]
    const bVal = b[key]
    // check nested equality
    if (typeof aVal === 'object' && typeof bVal === 'object') {
      return isObjectEqual(aVal, bVal)
    }
    return String(aVal) === String(bVal)
  })
}

export function isIncludedRoute (current: Route, target: Route): boolean {
  return (
    current.path.replace(trailingSlashRE, '/').indexOf(
      target.path.replace(trailingSlashRE, '/')
    ) === 0 &&
    (!target.hash || current.hash === target.hash) &&
    queryIncludes(current.query, target.query)
  )
}

function queryIncludes (current: Dictionary<string>, target: Dictionary<string>): boolean {
  for (const key in target) {
    if (!(key in current)) {
      return false
    }
  }
  return true
}
