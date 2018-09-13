/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 一个观察者解析表达式，进行依赖收集的观察者，
// 同时在表达式数据变更时触发回调函数。它被用于$watch api以及指令
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean; // stateMixin： 用户手动创建观察者 (core/instance/state.js)
  lazy: boolean; // initComputed，computedWatcherOptions参数传递了一个lazy为true会使得watch实例的dirty为true (core/instance/state.js)
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    // 将当前组件实例对象 vm 赋值给该观察者实例的 this.vm 属性，
    // 也就是说每一个观察者实例对象都有一个 vm 实例属性，该属性指明了这个观察者是属于哪一个组件的
    this.vm = vm
    // _watchers存放订阅者实例
    vm._watchers.push(this)
    // options
    if (options) {
      // 判断变量a为非空，未定义或者非空串才能执行方法体的内容
      // a!=null&&typeof(a)!=undefined&&a!=''
      // 用来告诉当前观察者实例对象是否是深度观测
      this.deep = !!options.deep
      // 用来标识当前观察者实例对象是 开发者定义的 还是 内部定义的
      this.user = !!options.user
      this.lazy = !!options.lazy
      // 用来告诉观察者当数据变化时是否同步求值并执行回调
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }

    // 它的值为 cb 回调函数
    this.cb = cb
    // 它是观察者实例对象的唯一标识
    this.id = ++uid // uid for batching
    // 它标识着该观察者实例对象是否是激活状态，默认值为 true 代表激活
    this.active = true
    // 定义了 this.dirty 属性，该属性的值与 this.computed 属性的值相同，也就是说只有计算属性的观察者实例对象的 this.dirty 属性的值才会为真，因为计算属性是惰性求值
    this.dirty = this.lazy // for lazy watchers【进行脏检查用的】
    
    // 它们就是传说中用来实现避免收集重复依赖，且移除无用依赖的功能也依赖于它们
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()

    // 在非生产环境下该属性的值为表达式(expOrFn)的字符串表示，在生产环境下其值为空字符串
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    // parse expression for getter
    // this.getter 函数终将会是一个函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 实例Watcher的时候对表达式求值，即实例属性data的取值，从发触发依赖的收集
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // 调用 this.get() 方法: 求值
    /* 
      一、求值的目的有两个，
      1、第一个是能够触发访问器属性的 get 拦截器函数，
      2、第二个是能够获得被观察目标的值
      二、现象
      1、this.value 属性保存着被观察目标的值
      2、正是因为对被观察目标的求值才得以触发数据属性的 get 拦截器函数
    */
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 将自身watcher观察者实例设置给Dep.target，用以依赖收集
    /*
      pushTarget 函数会将接收到的参数赋值给 Dep.target 属性，传递给 pushTarget 函数的参数就是调用该函数的观察者对象，
      所以 Dep.target 保存着一个观察者对象，其实这个观察者对象就是即将要收集的目标。
    */
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 对表达式求值，触发依赖的收集
      // 函数的执行就意味着对被观察目标的求值，并将得到的值赋值给 value 变量，而且我们可以看到 this.get 方法的最后将 value 返回
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 如果存在deep，则触发每个深层对象的依赖，追踪其变化
      if (this.deep) {
        // 递归每一个对象或者数组，触发它们的getter，
        // 使得对象或数组的每一个成员都被依赖收集，形成一个“深（deep）”依赖关系
        traverse(value)
      }
      // 将观察者实例从target栈中取出并设置给Dep.target
      popTarget()
      /* 
        每次求值完毕后都会使用 depIds 属性和 deps 属性保存 newDepIds 属性和 newDeps 属性的值，
        然后再清空 newDepIds 属性和 newDeps 属性的值
      */
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 调用Dep的addSub收集依赖
  addDep (dep: Dep) {
    /*    
      了解了 addSub 方法之后，我们再回到如下这段代码：
      addDep (dep: Dep) {
        dep.addSub(this)
      }
      我们修改了 addDep 方法，直接在 addDep 方法内调用 dep.addSub 方法，并将当前观察者对象作为参数传递。这不是很好吗？
      难道有什么问题吗？当然有问题，假如我们有如下模板：

      <div id="demo">
        {{name}}{{name}}
      </div>
      这段模板的不同之处在于我们使用了两次 name 数据，那么相应的渲染函数也将变为如下这样：

      function anonymous () {
        with (this) {
          return _c('div',
            { attrs:{ "id": "demo" } },
            [_v("\n      "+_s(name)+_s(name)+"\n    ")]
          )
        }
      }
      可以看到，渲染函数的执行将读取两次数据对象 name 属性的值，这必然会触发两次 name 属性的 get 拦截器函数，同样的道理，dep.depend 也将被触发两次，
      最后导致 dep.addSub 方法被执行了两次，且参数一模一样，这样就产生了同一个观察者被收集多次的问题。所以我们不能像如上那样修改 addDep 函数的代码，那么此时我相信大家也应该知道如下高亮代码的含义了：
    */
    const id = dep.id
    /*
      在 addDep 内部并不是直接调用 dep.addSub 收集观察者，而是先根据 dep.id 属性检测该 Dep 实例对象是否已经存在于 newDepIds 中，
      如果存在那么说明已经收集过依赖了，什么都不会做。
      如果不存在才会继续执行 if 语句块的代码，
      同时将 dep.id 属性和 Dep 实例对象本身分别添加到 newDepIds 和 newDeps 属性中，
      这样无论一个数据属性被读取了多少次，对于同一个观察者它只会收集一次。
    */
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      /* 
        1、newDepIds 属性用来在一次求值中避免收集重复的观察者
        2、每次求值并收集观察者完成之后会清空 newDepIds 和 newDeps 这两个属性的值，并且在被清空之前把值分别赋给了 depIds 属性和 deps 属性
        3、depIds 属性用来避免重复求值时收集重复的观察者

        结论：
        1、newDepIds 和 newDeps 这两个属性的值所存储的总是当次求值所收集到的 Dep 实例对象，
        2、depIds 和 deps 这两个属性的值所存储的总是上一次求值过程中所收集到的 Dep 实例对象
      */
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 调用Dep的removeSub清理依赖
  cleanupDeps () {
    /* 
      对 deps 数组进行遍历，也就是对上一次求值所收集到的 Dep 对象进行遍历，
      然后在循环内部检查上一次求值所收集到的 Dep 实例对象是否存在于当前这次求值所收集到的 Dep 实例对象中，
      
      如果不存在则说明该 Dep 实例对象已经和该观察者不存在依赖关系了，
      这时就会调用 dep.removeSub(this) 方法并以该观察者实例对象作为参数传递，从而将该观察者对象从 Dep 实例对象中移除。
    */
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // newDepIds 属性和 newDeps 属性被清空，
    // 并且在被清空之前把值分别赋给了 depIds 属性和 deps 属性，
    // 这两个属性将会用在下一次求值时避免依赖的重复收集
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // 调度者接口，当依赖发生改变的时候进行回调。
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      // 同步则执行run直接渲染视图
      this.run()
    } else {
      // 异步推送到观察者队列中，下一个tick时调用。
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    // 标识一个观察者是否处于激活状态，或者可用状态
    if (this.active) {
      // Dep.target = new Watch() -> 取值parsePath(expOrFn) -> 触发get进行依赖收集
      /*
        对于渲染函数的观察者来讲，重新求值其实等价于重新执行渲染函数，
        最终结果就是重新生成了虚拟DOM并更新真实DOM，这样就完成了重新渲染的过程
      */
      const value = this.get()
      /*
        对于渲染函数的观察者来讲并不会执行这个 if 语句块，
        因为 this.get 方法的返回值其实就等价于 updateComponent 函数的返回值，这个值将永远都是 undefined。

        实际上 if 语句块内的代码是为非渲染函数类型的观察者准备的，它用来对比新旧两次求值的结果，
        当值不相等的时候会调用通过参数传递进来的回调
      */
      if (
        /*新值和旧值不等的时候*/
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        /*新值和旧值如果相等但是新值是对象的话*/
        isObject(value) ||
        this.deep
      ) {
        // set new value
        // 保存旧值
        const oldValue = this.value
        // 存储新值
        this.value = value
        /*
          this.user 为真意味着这个观察者是开发者定义的，所谓开发者定义的是指那些通过 watch 选项或 $watch 函数定义的观察者，
          这些观察者的特点是回调函数是由开发者编写的，所以这些回调函数在执行的过程中其行为是不可预知的，很可能出现错误，
          这时候将其放到一个 try...catch 语句块中，这样当错误发生时我们就能够给开发者一个友好的提示
        */
        if (this.user) {
          try {
            // 回调传递新值和旧值
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            /*
              提示信息中包含了 this.expression 属性，我们前面说过该属性是被观察目标(expOrFn)的字符串表示，
              这样开发者就能清楚的知道是哪里发生了错误。
            */
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 获取观察者的值
  // 实际是脏检查，在计算属性中的依赖发生改变的时候dirty会变成true
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // 调用Dep的方法: 收集该watcher的所有deps依赖
  depend () {
    let i = this.deps.length
    while (i--) {
      // 调用Dep的方法: Dep.target.addDep(this)
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // 将自身从所有依赖收集订阅列表删除 (Vue.prototype.$watch封装: /core/instance/state.js)
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      /*
        每个组件实例都有一个 vm._isBeingDestroyed 属性，它是一个标识，
        为真说明该组件实例已经被销毁了，为假说明该组件还没有被销毁，
        所以以上代码的意思是如果组件没有被销毁，那么将当前观察者实例从组件实例对象的 vm._watchers 数组中移除，

        我们知道 vm._watchers 数组中包含了该组件所有的观察者实例对象，
        所以将当前观察者实例对象从 vm._watchers 数组中移除是解除属性与观察者实例对象之间关系的第一步。
        由于这个参数的性能开销比较大，所以仅在组件没有被销毁的情况下才会执行此操作。
      */
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      /*
        我们知道当一个属性与一个观察者建立联系之后，属性的 Dep 实例对象会收集到该观察者对象，
        同时观察者对象也会将该 Dep 实例对象收集，这是一个双向的过程，

        并且一个观察者可以同时观察多个属性，这些属性的 Dep 实例对象都会被收集到该观察者实例对象的 this.deps 数组中，
        所以解除属性与观察者之间关系的第二步就是将当前观察者实例对象从所有的 Dep 实例对象中移除
      */
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // 最后会将当前观察者实例对象的 active 属性设置为 false，代表该观察者对象已经处于非激活状态了：
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
/* 
data () {
  return {
    a: {
      b: 1
    }
  }
},
watch: {
  a () {
    console.log('a 改变了')
  }
}

数据对象 data 的属性 a 是一个对象，当实例化 Watcher 对象并观察属性 a 时，会读取属性 a 的值，这样的确能够触发属性 a 的 get 拦截器函数，但由于没有读取 a.b 属性的值，所以对于 b 来讲是没有收集到任何观察者的。
这就是我们常说的浅观察，直接修改属性 a 的值能够触发响应，而修改 a.b 的值是触发不了响应的。


traverse 函数的作用就是递归地读取被观察属性的所有子属性的值，
这样被观察属性的所有子属性都将会收集到观察者，从而达到深度观测的目的
*/
const seenObjects = new Set()
// 用来存放Oberser实例等id，避免重复读取
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}
// 递归
function _traverse (val: any, seen: ISet) {
  let i, keys
  // 不是数组、对象、不可扩展，不存在深层遍历
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }

  /*
    这段代码的作用不容忽视，它解决了循环引用导致死循环的问题，为了更好地说明问题我们举个例子，如下：
    const obj1 = {}
    const obj2 = {}

    obj1.data = obj2
    obj2.data = obj1

    上面代码中我们定义了两个对象，分别是 obj1 和 obj2，并且 obj1.data 属性引用了 obj2，而 obj2.data 属性引用了 obj1，
    这是一个典型的循环引用，假如我们使用 obj1 或 obj2 这两个对象中的任意一个对象出现在 Vue 的响应式数据中，如果不做防循环引用的处理，将会导致死循环
  */
  if (val.__ob__) {
    /*
      为了避免这种情况的发生，我们可以使用一个变量来存储那些已经被遍历过的对象，
      当再次遍历该对象时程序会发现该对象已经被遍历过了，这时会跳过遍历，从而避免死循环
      

      if 语句块用来判断 val.__ob__ 是否有值，我们知道如果一个响应式数据是对象或数组，那么它会包含一个叫做 __ob__ 的属性，
      这时我们读取 val.__ob__.dep.id 作为一个唯一的ID值，并将它放到 seenObjects 中：seen.add(depId)，
      这样即使 val 是一个拥有循环引用的对象，当下一次遇到该对象时，我们能够发现该对象已经遍历过了：seen.has(depId)，这样函数直接 return 即可。
    */
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }

  // 观测的是数组：深层访问数组子元素
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  }
  // 观测的是对象：深层访问对象子元素
  else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
