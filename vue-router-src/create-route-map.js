/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

/*根据 routes 配置对象创建路由 map：
  一、pathList：存储所有路由配置的 path
  二、pathMap：path <=> 路由记录 映射表
  三、nameMap：name <=> 路由记录  映射表
*/
export function createRouteMap (
  routes: Array<RouteConfig>, /*routes 配置对象*/
  oldPathList?: Array<string>, /*不传为空数组*/
  oldPathMap?: Dictionary<RouteRecord>, /*不传为空对象*/
  oldNameMap?: Dictionary<RouteRecord> /*不传为空对象*/
): {
  pathList: Array<string>;
  pathMap: Dictionary<RouteRecord>;
  nameMap: Dictionary<RouteRecord>;
} {
  /*一、创建映射表*/
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  /*二、遍历配置对象的 routes 配置：为每个路由配置添加路由记录*/
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  /*三、确保通配符在 pathList 数组中最后一项*/
  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  /*最后返回路由 map 对象*/
  return {
    pathList, /*存储所有路由配置的 path*/
    pathMap,  /*path <=> 路由记录 映射表*/
    nameMap /*name <=> 路由记录  映射表*/
  }
}

/*遍历配置对象的 routes 配置，添加路由记录。主要做了以下几件事：
  一、创建一个路由记录对象：路由配置含有 children 配置项的情况，保存父级路由配置
  二、路由配置含有 children 配置项的情况：循环添加路由记录
  三、路由配置含有 alias 配置项的情况：相当于新增了一项路由配置
  四、生成 path 映射表：pathMap 中不含当前规范化的 path 配置项，将 path 对应的路由对象存储下来
  五、生成 name 映射表：nameMap 中不含当前路由配置的  name 项，将 name 对应的路由对象存储下来
*/
function addRouteRecord (
  pathList: Array<string>, /*初始为空数组*/
  pathMap: Dictionary<RouteRecord>, /*初始为空对象*/
  nameMap: Dictionary<RouteRecord>, /*初始为空对象*/
  route: RouteConfig,  /*routes 配置对象的某一项*/
  parent?: RouteRecord, /*父级路由配置：初始不传*/
  matchAs?: string /*路由配置的 children 项的某一项路由配置的 path（层级子级）：初始不传*/
) {
  /*取出路由配置的 path 和 name 项*/
  const { path, name } = route
  /*path 不能为空，component 不能为字符串*/
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(path || name)} cannot be a ` +
      `string id. Use an actual component instead.`
    )
  }

  /*path-to-regexp 选项: 2.6.0 新增*/
  const pathToRegexpOptions: PathToRegexpOptions = route.pathToRegexpOptions || {}
  /*规范化路由配置的 path 项*/
  const normalizedPath = normalizePath(
    path, /*路由配置的 path 项*/
    parent, /*当前  path 项 的父级路由*/
    pathToRegexpOptions.strict /*路由配置 route.pathToRegexpOptions.strict */
  )

  /*对路径进行正则匹配是否区分大小写, 该属性是 2.6.0 新增*/
  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  /*一、创建一个路由记录对象：路由配置含有 children 配置项的情况，保存父级路由配置*/
  const record: RouteRecord = {
    path: normalizedPath, /*规范化后的路由配置的 path 项*/
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), /*对路由配置的 path 项编译解析（存在动态路由）*/
    components: route.components || { default: route.component }, /*路由配置的 component 项*/
    instances: {},
    name, /*路由配置的 name 项*/
    parent,
    matchAs,
    redirect: route.redirect, /*路由配置的 redirect 项*/
    beforeEnter: route.beforeEnter, /*路由配置的 beforeEnter 项*/
    meta: route.meta || {}, /*路由配置的 meta 项*/
    props: route.props == null /*路由配置的 props 项*/
      ? {}
      : route.components
        ? route.props
        : { default: route.props }
  }

  /*二、路由配置含有 children 配置项的情况：循环添加路由记录*/
  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      /*路由配置存在 name，不存在 redirect，child.path 为 '/' 或者 '' 的情况*/
      if (route.name && !route.redirect && route.children.some(child => /^\/?$/.test(child.path))) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
          `When navigating to this named route (:to="{name: '${route.name}'"), ` +
          `the default child route will not be rendered. Remove the name from ` +
          `this route and use the name of the default child route for named ` +
          `links instead.`
        )
      }
    }
    /*循环遍历路由配置的 children 项*/
    route.children.forEach(child => {
      /*路由配置的 children 项的某一项路由配置的 path（层级子级）*/
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      /*循环遍历子路由*/
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  /*三、路由配置含有 alias 配置项的情况：相当于新增了一项路由配置*/
  if (route.alias !== undefined) {
    /*规范化路由配置对象的 alias 项，保证为数组*/
    const aliases = Array.isArray(route.alias)
      ? route.alias
      : [route.alias]
    /*访问别名路由，实际访问的是 path 路由*/
    aliases.forEach(alias => {
      /*routes 配置对象的某一项*/
      const aliasRoute = {
        path: alias, /*path 修改为 alias*/
        children: route.children /*含有 children 配置项的话，整个 children 全部新增了*/
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute, /*routes 配置对象的某一项*/
        parent,
        record.path || '/' // matchAs
      )
    })
  }

  /*四、生成 path <=> 路由记录  映射表：pathMap 中不含当前规范化的 path 配置项，将 path 对应的路由对象存储下来*/
  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  /*五、生成 name <=> 路由记录  映射表：nameMap 中不含当前路由配置的  name 项，将 name 对应的路由对象存储下来*/
  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
        `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

/*对路由配置的 path 项编译解析（存在动态路由）*/
function compileRouteRegex (
  path: string, /*规范化后的路由配置的 path 项*/
  pathToRegexpOptions: PathToRegexpOptions /*路由配置 route.pathToRegexpOptions */
): RouteRegExp {
  /*路径 path 、数组 keys、配置项 options*/
  const regex = Regexp(path, [], pathToRegexpOptions)
  /*使用方法：
    法一：
    var keys = []
    var regex = Regexp('/foo/:bar', keys)
    // regex = /^\/foo\/([^\/]+?)\/?$/i
    // keys = [{ name: 'bar', prefix: '/', delimiter: '/', optional: false, repeat: false, pattern: '[^\\/]+?' }]

    法二：
    var regex = Regexp('/:foo/:bar')
    // keys = [{ name: 'foo', prefix: '/', ... }, { name: 'bar', prefix: '/', ... }]
    regex.exec('/test/route')
    //=> ['/test/route', 'test', 'route']
  */
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      /*key.name 为唯一，不能重复*/
      warn(!keys[key.name], `Duplicate param keys in route with path: "${path}"`)
      keys[key.name] = true
    })
  }
  /*返回解析规则*/
  return regex
}

/*规范化路由配置的 path 项*/
function normalizePath (
  path: string, /*路由配置的 path 项*/
  parent?: RouteRecord, /*当前 path 项 的父级路由*/
  strict?: boolean /*路由配置 route.pathToRegexpOptions.strict */
): string {
  /*没有 route.pathToRegexpOptions.strict 配置项，将 path 结尾的 / 去掉*/
  if (!strict) path = path.replace(/\/$/, '')
  /*路由配置的 path 项 第一位是 / 的情况，直接返回 路由配置的 path 项，此为全局路由的配置*/
  if (path[0] === '/') return path
  /*当前 path 项 不存在父级路由的情况，直接返回 路由配置的 path 项*/
  if (parent == null) return path

  /*将传入的 path 中的双斜杠 替换成 一个斜杠*/
  return cleanPath(`${parent.path}/${path}`)
}
