/* @flow */

// these helpers produces better vm code in JS engines due to their
// explicitness and function inlining
// 是undefined或者null类型
export function isUndef (v: any): boolean %checks {
  return v === undefined || v === null
}

// 不是undefined也不是null类型
export function isDef (v: any): boolean %checks {
  return v !== undefined && v !== null
}

// 传入的值时true的话
export function isTrue (v: any): boolean %checks {
  return v === true
}

export function isFalse (v: any): boolean %checks {
  return v === false
}

/**
 * Check if value is primitive
 */
// 指的是基本类型
export function isPrimitive (value: any): boolean %checks {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
// 不是null的一个对象，
export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value e.g. [object Object]
 */
const _toString = Object.prototype.toString
// 返回参数值得JS类型
export function toRawType (value: any): string {
  return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
// 是javascript对象
export function isPlainObject (obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

export function isRegExp (v: any): boolean {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
// 数组的index是合法的
export function isValidArrayIndex (val: any): boolean {
  const n = parseFloat(String(val))
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * Convert a value to a string that is actually rendered.
 */
export function toString (val: any): string {
  return val == null
    ? ''
    : typeof val === 'object'
      ? JSON.stringify(val, null, 2)
      : String(val)
}

/**
 * Convert a input value to a number for persistence.
 * If the conversion fails, return original string.
 */
export function toNumber (val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
// 生成一个map对象，返回一个函数，判断key值是否在这个map对象中
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  const map = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  // 返回一个函数，函数返回这个map对象的某个属性 (可能是不存在的某个属性名)
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 */
// makeMap生成一个map对象，返回一个函数，判断key值是否在这个map对象中，同时key值不区分大小写
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if a attribute is a reserved attribute.
 */
// makeMap生成一个map对象，返回一个函数，判断key值是否在这个map对象中
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * Remove an item from an array
 */
// 从数组中移除指定条目，返回此条目数组
export function remove (arr: Array<any>, item: any): Array<any> | void {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether the object has the property.
 */
// obj对象或数组是否有key属性
const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn (obj: Object | Array<*>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */
// 传入函数fn，返回函数闭包
export function cached<F: Function> (fn: F): F {
  const cache = Object.create(null)
  // 返回函数：参数str
  return (function cachedFn (str: string) {
    const hit = cache[str]
    // 最后返回函数：fn(str)
    return hit || (cache[str] = fn(str))
  }: any)
}

/**
 * Camelize a hyphen-delimited string.
 */
// 转成驼峰形式 a_b  => aB
const camelizeRE = /-(\w)/g
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * Capitalize a string.
 */
// 首字母大写
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 */
// 连接一个camelCase字符串('AbcPAE' -> 'abc-p-a-e')
// 'AbcPAE'.match(hyphenateRE) -> ["P", "A", "E"]
// \b单词边界，如果字符的左右两边有空白字符则为单词边界
// \B'非单词边界'字符左右两边没有空白字符 
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  // $1指的是匹配到的位置，在reg正则表达式里的几对"()"，$1指的是匹配的第一个括号
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * Simple bind, faster than native
 */
export function bind (fn: Function, ctx: Object): Function {
  function boundFn (a) {
    const l: number = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }
  // record original fn length
  boundFn._length = fn.length
  return boundFn
}

/**
 * Convert an Array-like object to a real Array.
 */
/**
 * [toArray 将类数组的对象转换成数组]
 * @param  {[type]} list:   any           [list可以为函数参数arguments、或者数组]
 * @param  {[type]} start?: number        [类数组开始位置]
 * @return {[type]}                       [description]
 */
export function toArray (list: any, start?: number): Array<any> {
  // 开始位置
  start = start || 0
  // 总长度
  let i = list.length - start
  // 定义数组
  const ret: Array<any> = new Array(i)
  // 转换成数组
  while (i--) {
    ret[i] = list[i + start]
  }
  // 返回数组
  return ret
}

/**
 * Mix properties into target object.
 */
// 对象浅拷贝（_from选项始终可用，但是to选项会覆盖同名的_from选项字段）
export function extend (to: Object, _from: ?Object): Object {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
export function toObject (arr: Array<any>): Object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/)
 */
// class C {
//     a: number;
//     b?: number;
// }
// let c = new C();
// c.a = 12;
// c.a = undefined; // error, 'undefined' is not assignable to 'number'
// c.b = 13;
// c.b = undefined; // ok
// c.b = null; // error, 'null' is not assignable to 'number | undefined'
// ------所以c?: any的意思是c的定义不能超出TypeScript的any类型范围
// 返回空函数
export function noop (a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 */
// 永远返回false
export const no = (a?: any, b?: any, c?: any) => false

/**
 * Return same value
 */
// 返回传入的参数
export const identity = (_: any) => _

/**
 * Generate a static keys string from compiler modules.
 */
// 其作用是根据编译器选项的 modules 选项生成一个静态键字符串
export function genStaticKeys (modules: Array<ModuleOptions>): string {
  return modules.reduce((keys, m) => {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
export function looseEqual (a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      const isArrayA = Array.isArray(a)
      const isArrayB = Array.isArray(b)
      if (isArrayA && isArrayB) {
        return a.length === b.length && a.every((e, i) => {
          return looseEqual(e, b[i])
        })
      } else if (!isArrayA && !isArrayB) {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        return keysA.length === keysB.length && keysA.every(key => {
          return looseEqual(a[key], b[key])
        })
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

export function looseIndexOf (arr: Array<mixed>, val: mixed): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
export function once (fn: Function): Function {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments)
    }
  }
}
