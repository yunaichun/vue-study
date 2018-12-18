/* @flow */
/*condition 不满足抛出异常*/
export function assert (condition: any, message: string) {
  if (!condition) {
    throw new Error(`[vue-router] ${message}`)
  }
}

/*condition 不满足 console 打印异常*/
export function warn (condition: any, message: string) {
  if (process.env.NODE_ENV !== 'production' && !condition) {
    typeof console !== 'undefined' && console.warn(`[vue-router] ${message}`)
  }
}

/*判断传入的 err 是否是 js 抛出的异常*/
export function isError (err: any): boolean {
  return Object.prototype.toString.call(err).indexOf('Error') > -1
}
