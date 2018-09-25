/* @flow */
/* globals MessageChannel */

import { handleError } from './error'

// can we use __proto__?
// 有__proto__属性方法
export const hasProto = '__proto__' in {}

// Browser environment sniffing
export const inBrowser = typeof window !== 'undefined' // 判断当前环境是否是浏览器环境
export const UA = inBrowser && window.navigator.userAgent.toLowerCase() // 判断当前环境是否是IE浏览器环境
export const isIE = UA && /msie|trident/.test(UA) // 判断当前环境是否是IE浏览器环境
export const isIE9 = UA && UA.indexOf('msie 9.0') > 0
export const isEdge = UA && UA.indexOf('edge/') > 0
export const isAndroid = UA && UA.indexOf('android') > 0
export const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)
export const isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge

// Firefox has a "watch" function on Object.prototype...
// 火狐浏览器在对象原型中有一个watch函数
export const nativeWatch = ({}).watch

export let supportsPassive = false
if (inBrowser) {
  try {
    const opts = {}
    Object.defineProperty(opts, 'passive', ({
      get () {
        /* istanbul ignore next */
        supportsPassive = true
      }
    }: Object)) // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null, opts)
  } catch (e) {}
}

// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
// 返回是否是服务端渲染
let _isServer
export const isServerRendering = () => {
  if (_isServer === undefined) {
    /* istanbul ignore if */
    if (!inBrowser && typeof global !== 'undefined') {
      // detect presence of vue-server-renderer and avoid
      // Webpack shimming the process
      // 服务端：检测VUE服务器渲染器的存在并避免Webpack shimming进程
      _isServer = global['process'].env.VUE_ENV === 'server'
    } else {
      // 非服务端
      _isServer = false
    }
  }
  return _isServer
}

// detect devtools
// 浏览器环境，同时也是VUE环境
export const devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__

/* istanbul ignore next */
// 返回是不是函数
export function isNative (Ctor: any): boolean {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

// es6中Symbol和Reflect均存在
export const hasSymbol =
  typeof Symbol !== 'undefined' && isNative(Symbol) &&
  typeof Reflect !== 'undefined' && isNative(Reflect.ownKeys)

/**
 * Defer a task to execute it asynchronously.
 */
 /* 返回一个函数：
    延迟一个任务使其异步执行，在下一个tick时执行，一个立即执行函数，返回一个function
    这个函数的作用是在task或者microtask中推入一个timerFunc，在当前调用栈执行完以后以此执行直到执行到timerFunc
    目的是延迟到当前调用栈执行完以后执行
*/
export const nextTick = (function () {
  /*
    它是一个标识，它的真假代表回调队列是否处于等待刷新的状态，初始值是 false 代表回调队列为空不需要等待刷新。
    假如此时在某个地方调用了 $nextTick 方法，那么 if 语句块内的代码将会被执行，
    在 if 语句块内优先将变量 pending 的值设置为 true，代表着此时回调队列不为空，正在等待刷新。
  */
  let pending = false
  // 相对主线程来说，这是一个异步任务队列的统一存放数组【callbacks -> nextTickHandler -> timerFunc】
  const callbacks = []
  // 相对主线程来说，这是一个异步任务队列的统一执行函数【callbacks -> nextTickHandler -> timerFunc】
  let timerFunc

  // 相对主线程来说，这是一个异步任务队列的统一存放数组的包裹回调函数【callbacks -> nextTickHandler -> timerFunc】
  function nextTickHandler () {
    // 首先将变量 pending 重置为 false
    pending = false
    // 接着开始执行回调，但需要注意的是在执行 callbacks 队列中的回调函数时并没有直接遍历 callbacks 数组，而是使用 copies 常量保存一份 callbacks 的复制，
    const copies = callbacks.slice(0)
    /*   
      遍历 copies 数组之前将 callbacks 数组清空：callbacks.length = 0
      为什么要这么做呢？这么做肯定是有原因的，我们模拟一下整个异步更新的流程就明白了，如下代码：
        created () {
          this.name = 'HcySunYang'
          this.$nextTick(() => {
            this.name = 'hcy'
            this.$nextTick(() => { console.log('第二个 $nextTick') })
          })
        }
      上面代码中我们在外层 $nextTick 方法的回调函数中再次调用了 $nextTick 方法，
      理论上外层 $nextTick 方法的回调函数不应该与内层 $nextTick 方法的回调函数在同一个 microtask 任务中被执行，
      而是两个不同的 microtask 任务，虽然在结果上看或许没什么差别，但从设计角度就应该这么做。


      我们注意上面代码中我们修改了两次 name 属性的值(假设它是响应式数据)，首先我们将 name 属性的值修改为字符串 HcySunYang，
      我们前面讲过这会导致依赖于 name 属性的渲染函数观察者被添加到 queue 队列中，
      这个过程是通过调用 src/core/observer/scheduler.js 文件中的 queueWatcher 函数完成的。
      同时在 queueWatcher 函数内会使用 nextTick 将 flushSchedulerQueue 添加到 callbacks 数组中，所以此时 callbacks 数组如下：
      callbacks = [
        flushSchedulerQueue // queue = [renderWatcher]
      ]


      同时会将 nextTickHandler 函数注册为 microtask，所以此时 microtask 队列如下：
      // microtask 队列
      [
        nextTickHandler
      ]


      接着调用了第一个 $nextTick 方法，$nextTick 方法会将其回调函数添加到 callbacks 数组中，那么此时的 callbacks 数组如下：
      callbacks = [
        flushSchedulerQueue, // queue = [renderWatcher]
        () => {
          this.name = 'hcy'
          this.$nextTick(() => { console.log('第二个 $nextTick') })
        }
      ]


      接下来主线程处于空闲状态(调用栈清空)，开始执行 microtask 队列中的任务，即执行 nextTickHandler 函数，
      nextTickHandler 函数会按照顺序执行 callbacks 数组中的函数，首先会执行 flushSchedulerQueue 函数，
      这个函数会遍历 queue 中的所有观察者并重新求值，完成重新渲染(re-render)，
      在完成渲染之后，本次更新队列已经清空，queue 会被重置为空数组，一切状态还原。接着会执行如下函数：
      () => {
        this.name = 'hcy'
        this.$nextTick(() => { console.log('第二个 $nextTick') })
      }


      这个函数是第一个 $nextTick 方法的回调函数，由于在执行该回调函数之前已经完成了重新渲染，所以该回调函数内的代码是能够访问更新后的DOM的，到目前为止一切都很正常，
      继续往下看，在该回调函数内再次修改了 name 属性的值为字符串 hcy，这会再次触发响应，同样的会调用 nextTick 函数将 flushSchedulerQueue 添加到 callbacks 数组中，
      但是由于在执行 nextTickHandler 函数时优先将 pending 的重置为 false，
      所以 nextTick 函数会将 nextTickHandler 函数注册为一个新的 microtask，此时 microtask 队列将包含两个 nextTickHandler 函数：
      // microtask 队列
      [
        nextTickHandler, // 第一个 nextTickHandler
        nextTickHandler  // 第二个 nextTickHandler
      ]


      怎么样？我们的目的达到了，现在有两个 microtask 任务。
      而另外除了将变量 pending 的值重置为 false 之外，我们要知道第一个 nextTickHandler 函数遍历的并不是 callbacks 本身，
      而是它的复制品 copies 数组，并且在第一个 nextTickHandler 函数的一开头就清空了 callbacks 数组本身。
      所以第二个 nextTickHandler 函数的一切流程与第一个 nextTickHandler 是完全相同。
    */
    callbacks.length = 0
    // 然后遍历 copies 数组
    for (let i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }

  // An asynchronous deferring mechanism.
  // In pre 2.4, we used to use microtasks (Promise/MutationObserver)
  // but microtasks actually has too high a priority and fires in between
  // supposedly sequential events (e.g. #4521, #6690) or even between
  // bubbling of the same event (#6566). Technically setImmediate should be
  // the ideal choice, but it's not available everywhere; and the only polyfill
  // that consistently queues the callback after all DOM events triggered in the
  // same loop is by using MessageChannel.
  /* istanbul ignore if */
  /* 
    https://www.jianshu.com/p/4f07ef18b5d7 
    常见的 macro task 有 setTimeout、MessageChannel、postMessage、setImmediate
    常见的 micro task 有 MutationObsever 和 Promise.then

    我们知道任务队列并非只有一个队列，在 node 中更为复杂，但总的来说我们可以将其分为 microtask 和 (macro)task，
    并且这两个队列的行为还要依据不同浏览器的具体实现去讨论，这里我们只讨论被广泛认同和接受的队列执行行为。
    当调用栈空闲后每次事件循环只会从 (macro)task 中读取一个任务并执行，而在同一次事件循环内会将 microtask 队列中所有的任务全部执行完毕，且要先于 (macro)task。
    另外 (macro)task 中两个不同的任务之间可能穿插着UI的重渲染，那么我们只需要在 microtask 中把所有在UI重渲染之前需要更新的数据全部更新，这样只需要一次重渲染就能得到最新的DOM了。
    恰好 Vue 是一个数据驱动的框架，如果能在UI重渲染之前更新所有数据状态，这对性能的提升是一个很大的帮助，所有要优先选用 microtask 去更新数据状态而不是 (macro)task，
    这就是为什么不使用 setTimeout 的原因，因为 setTimeout 会将回调放到 (macro)task 队列中而不是 microtask 队列，
    所以理论上最优的选择是使用 Promise，当浏览器不支持 Promise 时再降级为 setTimeout
  */
  // 定义timerFunc函数 -> 优先级：setImmediate -> MessageChannel -> Promise.then -> setTimeout
  if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    timerFunc = () => {
      /*
        为什么首选 setImmediate 呢？这是有原因的，因为 setImmediate 拥有比 setTimeout 更好的性能，
        这个问题很好理解，setTimeout 在将回调注册为 (macro)task 之前要不停的做超时检测，而 setImmediate 则不需要，这就是优先选用 setImmediate 的原因。

        但是 setImmediate 的缺陷也很明显，就是它的兼容性问题，到目前为止只有IE浏览器实现了它，
        所以为了兼容非IE浏览器我们还需要做兼容处理，只不过此时还轮不到 setTimeout 上场，而是使用 MessageChannel
      */
      setImmediate(nextTickHandler)
    }
  } 
  else if (typeof MessageChannel !== 'undefined' && 
    (
      isNative(MessageChannel) ||
      // PhantomJS
      MessageChannel.toString() === '[object MessageChannelConstructor]'
    )
  ) {
    /*
      Web Workers 的内部实现就是用到了 MessageChannel，一个 MessageChannel 实例对象拥有两个属性 port1 和 port2，
      我们只需要让其中一个 port 监听 onmessage 事件，然后使用另外一个 port 的 postMessage 向前一个 port 发送消息即可，

      这样前一个 port 的 onmessage 回调就会被注册为 (macro)task，由于它也不需要做任何检测工作，所以性能也要优于 setTimeout
    */
    const channel = new MessageChannel()
    const port = channel.port2
    channel.port1.onmessage = nextTickHandler
    timerFunc = () => {
      port.postMessage(1)
    }
  }
  /* istanbul ignore next */
  else if (typeof Promise !== 'undefined' && isNative(Promise)) {
    // use microtask in non-DOM environments, e.g. Weex
    // 使用Promise
    const p = Promise.resolve()
    timerFunc = () => {
      p.then(nextTickHandler)
    }
  } 
  else {
    // fallback to setTimeout
    timerFunc = () => {
      setTimeout(nextTickHandler, 0)
    }
  }

  // cb 回调函数，ctx 上下文
  return function queueNextTick (cb?: Function, ctx?: Object) {
    /*
      当 nextTick 函数没有接收到 cb 参数时，会检测当前宿主环境是否支持 Promise，如果支持则直接返回一个 Promise 实例对象，
      并且将 resolve 函数赋值给 _resolve 变量，_resolve 变量声明在 nextTick 函数的顶部。
    */
    let _resolve
    /*
      注意并不是将 cb 回调函数直接添加到 callbacks 数组中，但这个被添加到 callbacks 数组中的函数的执行会间接调用 cb 回调函数，
      并且可以看到在调用 cb 函数时使用 .call 方法将函数 cb 的作用域设置为 ctx，也就是 nextTick 函数的第二个参数。

      所以对于 $nextTick 方法来讲，传递给 $nextTick 方法的回调函数的作用域就是当前组件实例对象，当然了前提是回调函数不能是箭头函数，
      其实在平时的使用中，回调函数使用箭头函数也没关系，只要你能够达到你的目的即可。

      另外我们再次强调一遍，此时回调函数并没有被执行，当你调用 $nextTick 方法并传递回调函数时，
      会使用一个新的函数包裹回调函数并将新函数添加到 callbacks 数组中。
    */
    callbacks.push(() => {
      /*
        当 nextTickHandler 函数开始执行 callbacks 数组中的函数时，
        如果有传递 cb 参数，则直接执行cb回调函数
      */
      if (cb) {
        try {
          cb.call(ctx)
        } catch (e) {
          handleError(e, ctx, 'nextTick')
        }
      }
      /*
        当 nextTickHandler 函数开始执行 callbacks 数组中的函数时，
        如果没有传递 cb 参数，则直接调用 _resolve 函数，我们知道这个函数就是返回的 Promise 实例对象的 resolve 函数。
        这样就实现了 Promise 方式的 $nextTick 方法。
      */
      else if (_resolve) {
        _resolve(ctx)
      }
    })
    // 执行异步回调
    if (!pending) {
      /*
        它是一个标识，它的真假代表回调队列是否处于等待刷新的状态，初始值是 false 代表回调队列为空不需要等待刷新。
        假如此时在某个地方调用了 $nextTick 方法，那么 if 语句块内的代码将会被执行，
        在 if 语句块内优先将变量 pending 的值设置为 true，代表着此时回调队列不为空，正在等待刷新。
      */
      pending = true
      /* 
        相对主线程来说，这是一个异步任务队列的统一执行函数【callbacks -> nextTickHandler -> timerFunc】
        执行timerFunc -> 执行nextTickHandler -> 执行callbacks中存放的cb回调函数
      */
      timerFunc()
    }
    // $flow-disable-line
    /*
      当 nextTick 函数没有接收到 cb 参数时，会检测当前宿主环境是否支持 Promise，如果支持则直接返回一个 Promise 实例对象，
      并且将 resolve 函数赋值给 _resolve 变量，_resolve 变量声明在 nextTick 函数的顶部。
    */
    if (!cb && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        _resolve = resolve
      })
    }
  }
})()

let _Set
/* istanbul ignore if */ // $flow-disable-line
if (typeof Set !== 'undefined' && isNative(Set)) {
  // use native Set when available.
  _Set = Set
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  _Set = class Set implements ISet {
    set: Object;
    constructor () {
      this.set = Object.create(null)
    }
    has (key: string | number) {
      return this.set[key] === true
    }
    add (key: string | number) {
      this.set[key] = true
    }
    clear () {
      this.set = Object.create(null)
    }
  }
}

interface ISet {
  has(key: string | number): boolean;
  add(key: string | number): mixed;
  clear(): void;
}

export { _Set }
export type { ISet }
