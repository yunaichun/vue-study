/* @flow */

import { _Vue } from '../install'
import { warn, isError } from './warn'

/*处理异步激活的路由组件*/
export function resolveAsyncComponents (matched: Array<RouteRecord>): Function {
  return (to, from, next) => {
    let hasAsync = false
    let pending = 0
    let error = null

    /*返回 matched 路由 map 出的新路由，map 的函数是 fn*/
    flatMapComponents(matched, (def, _, match, key) => { /*matched[i].components[key]、matched[i].instances[key]、matched[i]、i*/
      // if it's a function and doesn't have cid attached,
      // assume it's an async component resolve function.
      // we are not using Vue's default async resolving mechanism because
      // we want to halt the navigation until the incoming component has been
      // resolved.
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        pending++

        /*定义 resolve 函数*/
        const resolve = once(resolvedDef => {
          /*是 ESModule 模块加载*/
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)
          match.components[key] = resolvedDef
          pending--
          if (pending <= 0) {
            next()
          }
        })

        /*定义 reject 函数*/
        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error)
          }
        })

        /*执行 Promise 函数*/
        let res
        try {
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }

        /*Promise 正确返回*/
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    /*递归执行*/    
    if (!hasAsync) next()
  }
}

/*返回 matched 路由 map 出的新路由，map 的函数是 fn*/
export function flatMapComponents (
  matched: Array<RouteRecord>, /*匹配的路由*/
  fn: Function /*map 的函数是 fn*/
): Array<?Function> {
  /*复制数组 matched 的拷贝*/
  return flatten(matched.map(m => {
    return Object.keys(m.components).map(key => fn(
      m.components[key], 
      m.instances[key],
      m, key
    ))
  }))
}

/*复制数组 arr 的拷贝*/
export function flatten (arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr)
}

const hasSymbol =
  typeof Symbol === 'function' &&
  typeof Symbol.toStringTag === 'symbol'

/*是 ESModule 模块加载*/
function isESModule (obj) {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

// in Webpack 2, require.ensure now also returns a Promise
// so the resolve/reject functions may get called an extra time
// if the user uses an arrow function shorthand that happens to
// return that Promise.
/*保证 fn 函数只会执行一次*/
function once (fn) {
  let called = false
  return function (...args) {
    if (called) return
    called = true
    return fn.apply(this, args)
  }
}
