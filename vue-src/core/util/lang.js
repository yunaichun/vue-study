/* @flow */

export const emptyObject = Object.freeze({})

/**
 * Check if a string starts with $ or _
 */
// 检测字符串是否以 $ 或者 _ 开头
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 */
// Object.defineProperty将对象变为访问器属性
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 */
/*
不是 \w，也就是说这个位置不能是 字母 或 数字 或 下划线
不是字符 .
不是字符 $

举几个例子如 obj~a、obj/a、obj*a、obj+a 等，这些字符串中的 ~、/、* 以及 + 字符都能成功匹配正则 bailRE，这时 parsePath 函数将返回 undefined，也就是解析失败。
 bailRE 正则只有如下这几种形式的字符串才能解析成功：obj.a、this.$watch 等，看到这里你也应该知道为什么 bailRE 正则中包含字符 . 和 $。
*/
const bailRE = /[^\w.$]/
export function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
