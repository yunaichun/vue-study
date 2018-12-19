/* @flow */

/*将传入的 path 中的双斜杠 替换成 一个斜杠*/
export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}

/*解析 path 路径：返回 url 的 Path 中解析出的 path、query、hash
  例：'http://10.13.69.104:8287/dpgtool/?a=1#/cameraMap'
  解析结果：
    {
      hash: "#/cameraMap"
      path: "http://10.13.69.104:8287/dpgtool/"
      query: "a=1"
    }
*/
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  /*path 中存在 hash：解析出 path 和 hash 值*/
  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }

  /*path 中存在 query：解析出 query 参数值*/
  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }

  /*返回 url 的 Path 中解析出的 path、query、hash*/
  return {
    path,
    query,
    hash
  }
}

/*处理路径拼接：
  一、resolvePath('/aaa', '/bbb', false)   ->   "/aaa"
  二、resolvePath('?aaa', '/bbb', false)   ->   "/bbb?aaa"
  三、resolvePath('aaa', '/bbb', true)   ->   "/bbb/aaa"
      resolvePath('aaa', '/bbb', false)   ->   "/aaa"
*/
export function resolvePath (
  relative: string, /*相对路径*/
  base: string, /*基础路径*/
  append?: boolean /*相对路径是否拼接到基础路径之后*/
): string {
  const firstChar = relative.charAt(0)
  /*一、相对路径首字符是 '/'：直接返回相对路径*/
  if (firstChar === '/') {
    return relative
  }

  /*二、相对路径是 '?' 或 '#'：返回 基础路径 + 相对路径*/
  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  /*三、处理基础路径：基础路径以 '/' 分割*/
  const stack = base.split('/')
  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    /*移除 stack 数组最后一项*/
    stack.pop()
  }

  // resolve relative path
  /*三、处理相对路径：相对路径以 '/' 分割*/
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    /*相对路径中含有 '..'，移除绝对路径*/
    if (segment === '..') {
      stack.pop()
    }
    /*相对路径中含有 '.'，绝对路径添加当前相对路径*/
    else if (segment !== '.') {
      stack.push(segment)
    }
  }

  // ensure leading slash
  /*保证第一个路径不为空字符串*/
  if (stack[0] !== '') {
    stack.unshift('')
  }

  /*返回最终拼接的路径*/
  return stack.join('/')
}
