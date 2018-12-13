/**
 * Get the first item that pass the test
 * by second argument function
 *
 * @param {Array} list
 * @param {Function} f
 * @return {*}
 */
/*对数组 list 执行 filter 过滤，过滤函数是 f 函数，返回过滤后的第一项*/
export function find (list, f) {
  return list.filter(f)[0]
}

/**
 * Deep copy the given object considering circular structure.
 * This function caches all nested objects and its copies.
 * If it detects circular structure, use cached copy to avoid infinite loop.
 *
 * @param {*} obj
 * @param {Array<Object>} cache
 * @return {*}
 */
export function deepCopy (obj, cache = []) {
  // just return if obj is immutable value
  /*异常处理：普通类型，或者为对象null*/
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // if obj is hit, it is in circular structure
  /*直接返回：cache = [{original: obj, copy: obj}]*/
  /*cache.filter(function(c) { c.original === obj; })[0]*/
  const hit = find(cache, c => c.original === obj)
  if (hit) {
    return hit.copy
  }

  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  cache.push({
    original: obj,
    copy
  })

  /*从空对象或者空数组开始递归调用*/
  Object.keys(obj).forEach(key => {
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}
// 深度拷贝
function myDeepCopy(parent) {
  let obj = Array.isArray(parent) ? [] : {};
  for (let key in parent) {
     if (parent.hasOwnProperty(key)) {
          if (typeof parent[key] === 'object') {
            obj[key] = deepCopy(parent[key]);
          } else {
            obj[key] = parent[key];
          }
     }
  }
  return obj;
}

/**
 * forEach for object
 */
/*遍历 obj 对象的每一项，执行 fn 函数*/
export function forEachValue (obj, fn) {
  /*fn 函数传入obj的value + key*/
  Object.keys(obj).forEach(key => fn(obj[key], key))
}

/*是否是 Object 判断*/
export function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

/*是否是 Promise 判断*/
export function isPromise (val) {
  return val && typeof val.then === 'function'
}

/*condition 为 false 时打印 msg 信息*/
export function assert (condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`)
}
