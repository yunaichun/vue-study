/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,   
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

// queue 常量是一个数组，存储异步观察者回调队列的
const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
// has 的作用就是用来避免将相同的观察者重复入队的
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
// flushing 变量是一个标志，放入队列 queue 中的所有观察者将会在突变完成之后统一执行更新，当更新开始时会将 flushing 变量的值设置为 true，代表着此时正在执行更新
let flushing = false
// waiting 同样是一个标志，无论调用多少次 queueWatcher 函数，该 if 语句块的代码只会执行一次
let waiting = false
let index = 0

/**
 * Reset the scheduler's state.
 */
// 重置调度者的状态
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
// flushSchedulerQueue 函数的作用之一就是用来将队列中的观察者统一执行更新的
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  /*
    给queue排序，这样做可以保证：
    1.组件更新的顺序是从父组件到子组件的顺序，因为父组件总是比子组件先创建。
    2.一个组件的user watchers比render watcher先运行，因为user watchers往往比render watcher更早创建
    3.如果一个组件在父组件watcher运行期间被销毁，它的watcher执行将被跳过。
  */
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 这里不用index = queue.length;index > 0; index--的方式写是因为不要将length进行缓存，
  // 因为在执行处理现有watcher对象期间，更多的watcher对象可能会被push进queue
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    // 将has的标记删除
    has[id] = null
    // 执行watcher
    watcher.run()
    // in dev build, check and stop circular updates.
    /*
      在测试环境中，检测watch是否在死循环中
      比如这样一种情况
      watch: {
        test () {
          this.test++;
        }
      }
      持续执行了一百次watch代表可能存在死循环
    */
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 得到队列的拷贝
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  // 重置调度者的状态
  resetSchedulerState()

  // call component updated and activated hooks
  // 使子组件状态都改编成active同时调用activated钩子
  callActivatedHooks(activatedQueue)
  // 调用updated钩子
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

// 使子组件状态都改编成active同时调用activated钩子
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

// 调用updated钩子
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
/*
  keep-alive组件保存在队列中，
  是到patch结束以后该队列会被处理
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
// 将观察者放到一个队列中等待所有突变完成之后统一执行更新
export function queueWatcher (watcher: Watcher) {
  // 察者对象的唯一 id
  const id = watcher.id
  // has 的作用就是用来避免将相同的观察者重复入队的
  if (has[id] == null) {
    // 将该观察者的 id 值登记到 has 对象上作为 has 对象的属性同时将该属性值设置为 true
    has[id] = true
    /*
      flushing 变量是一个标志，我们知道放入队列 queue 中的所有观察者将会在突变完成之后统一执行更新，
      当更新开始时会将 flushing 变量的值设置为 true，代表着此时正在执行更新，
      所以根据判断条件 if (!flushing) 可知只有当队列没有执行更新时才会简单地将观察者追加到队列的尾部，

      有的同学可能会问：“难道在队列执行更新的过程中还会有观察者入队的操作吗？”，实际上是会的，
      典型的例子就是计算属性，比如队列执行更新时经常会执行渲染函数观察者的更新，渲染函数中很可能有计算属性的存在，
      由于计算属性在实现方式上与普通响应式属性有所不同，所以当触发计算属性的 get 拦截器函数时会有观察者入队的行为，这个时候我们需要特殊处理，也就是 else 分支的代码
    */
    if (!flushing) {
      // 如果没有flush掉，直接push到队列中即可
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      /*
        当变量 flushing 为真时，说明队列正在执行更新，
        这时如果有观察者入队则会执行 else 分支中的代码，
        这段代码的作用是为了保证观察者的执行顺序
      */
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true
      // flushSchedulerQueue 函数的作用之一就是用来将队列中的观察者统一执行更新的
      nextTick(flushSchedulerQueue)
    }
  }
}
