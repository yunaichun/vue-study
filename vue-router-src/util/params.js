/* @flow */

import { warn } from './warn'
import Regexp from 'path-to-regexp'

// $flow-disable-line
const regexpCompileCache: {
  [key: string]: Function
} = Object.create(null)

/*将动态路由解析成对象的形式：
  例：let toPath = Regexp.compile('/user/:id')
      toPath({ id: 123 }) //=> "/user/123"
*/
export function fillParams (
  path: string, /*浏览器 path*/
  params: ?Object, /*浏览器 params*/
  routeMsg: string
): string {
  try {
    const filler =
      regexpCompileCache[path] ||
      (regexpCompileCache[path] = Regexp.compile(path))
    return filler(params || {}, { pretty: true })
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      warn(false, `missing param for ${routeMsg}: ${e.message}`)
    }
    return ''
  }
}
