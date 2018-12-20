/* @flow */

import { warn } from './warn'

/*
  var str = '[';
  // 字符串对应数字编码
  str.charCodeAt(0) === 91
  // 数字编码对应字符串
  String.fromCharCode(91)
  String.fromCharCode(0x5b)
  // 十进制转为十六进制
  str.charCodeAt(0).toString(16) === '5b'
  // 十六进制转为十进制
  0x5b.toString(10) === '91'
*/
/*保留字符：!'()*  */
const encodeReserveRE = /[!'()*]/g
/*保留字符替换成的字符：'%' + c.charCodeAt(0).toString(16)*/
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
/* %2C 是用 URL 编码形式表示的 ASCII 字符','*/
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
/*返回 URL 编码形式表示的 ASCII 字符：
  例：encodeURIComponent('a=a&b=b')
      "a%3Da%26b%3Db"
*/
const encode = str => encodeURIComponent(str)
  .replace(encodeReserveRE, encodeReserveReplacer)
  .replace(commaRE, ',')

const decode = decodeURIComponent

/*query 参数的 stringifyQuery：
  例：query = { foo: [1, 2], bar: { a: 1, b: 2 }, test: 2 };
      stringifyQuery(query);
      最终返回："?foo=1&foo=2&bar=%5Bobject%20Object%5D&test=2"
    
*/
export function stringifyQuery (obj: Dictionary<string>): string {
  /*遍历 query 查询参数*/
  const res = obj ? Object.keys(obj).map(key => {
    /*获取当前项的值*/
    const val = obj[key]
    /*当前项的值 undefined 转为空字符串*/
    if (val === undefined) {
      return ''
    }

    /*当前项的值 null 转为数字编码的 key 值：数字编码 + %*/
    if (val === null) {
      return encode(key)
    }

     /*当前项的值 Array 遍历每一项：数字编码的 key 和 value */
    if (Array.isArray(val)) {
      const result = []
      /*循环遍历数组项*/
      val.forEach(val2 => {
        /*项为 undefined*/
        if (val2 === undefined) {
          return
        }
        /*项为 null*/
        if (val2 === null) {
          result.push(encode(key))
        }
        /*项不为 undefined、null*/
        else {
          result.push(encode(key) + '=' + encode(val2))
        }
      })
      return result.join('&')
    }

    /*value 不是 undefined/null/Array：返回 URL 编码形式表示的 ASCII 字符*/
    return encode(key) + '=' + encode(val)
  }).filter(x => x.length > 0).join('&') : null
  /*返回的结果前添加上 ? */
  return res ? `?${res}` : ''
}

/*query 参数处理：
  例：parseQuery('a=1&a=1&b=2')
  结果：{a: [1, 1], b: "2"}
*/
export function resolveQuery (
  query: ?string, /*初始 query 参数*/
  extraQuery: Dictionary<string> = {}, /*额外 query 参数*/
  _parseQuery: ?Function /*query 解析函数*/
): Dictionary<string> {
  const parse = _parseQuery || parseQuery
  let parsedQuery
  try {
    /*解析 query 参数*/
    parsedQuery = parse(query || '')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    parsedQuery = {}
  }
  /*将额外 query 参数混入到初始 query 参数*/
  for (const key in extraQuery) {
    parsedQuery[key] = extraQuery[key]
  }
  return parsedQuery
}

/*解析 query 参数
  例：parseQuery('a=1&a=1&b=2')
  结果：{a: [1, 1], b: "2"}
*/
function parseQuery (query: string): Dictionary<string> {
  const res = {}

  /*query 参数去除左右空格，同时将 ?|#|& 符号去除*/
  query = query.trim().replace(/^(\?|#|&)/, '')

  if (!query) {
    return res
  }

  /*遍历 query 参数*/
  query.split('&').forEach(param => {
    /*解析出 query 的每一项*/
    const parts = param.replace(/\+/g, ' ').split('=')
    /*query 的 key*/
    const key = decode(parts.shift())
    /*query 的 value*/
    const val = parts.length > 0
      ? decode(parts.join('='))
      : null

    /*res[key] 初始没有值*/
    if (res[key] === undefined) {
      res[key] = val
    }
    /*res[key] 初始有值，值为数组*/
    else if (Array.isArray(res[key])) {
      res[key].push(val)
    }
    /*res[key] 初始有值，值不为数组*/
    else {
      res[key] = [res[key], val]
    }
  })

  return res
}
