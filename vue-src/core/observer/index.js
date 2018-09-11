/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

// 一个新的数组对象，该对象的原型指向Array.prototype
// 获取此对象的属性keys
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 */
 // 是否开启数据监听的开关：默认为true
export const observerState = {
  shouldConvert: true
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 尝试创建一个Observer实例（__ob__），如果成功创建Observer实例则返回新的Observer实例，
// 如果已有Observer实例则返回现有的Observer实例。
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 如果要观测的数据不是一个对象或者是 VNode 实例，则直接 return
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 当一个数据对象被观测之后将会在该对象上定义 __ob__ 属性，
  // 所以 if 分支的作用是用来避免重复观测一个数据对象
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } 
  // 如果数据对象上没有定义 __ob__ 属性，那么说明该对象没有被观测过
  else if (
    // 是否开启数据监听的开关：默认为true
    observerState.shouldConvert &&
    // isServerRendering() 函数的返回值是一个布尔值，用来判断是否是服务端渲染
    !isServerRendering() &&
    // 当数据对象是数组或纯对象的时候，才有必要对其进行观测
    (Array.isArray(value) || isPlainObject(value)) &&
    // 要被观测的数据对象必须是可扩展的。一个普通的对象默认就是可扩展的
    // 以下三个方法都可以使得一个对象变得不可扩展：Object.preventExtensions()、Object.freeze() 以及 Object.seal()
    Object.isExtensible(value) &&
    // Vue 实例对象拥有 _isVue 属性，所以这个条件用来避免 Vue 实例对象被观测 (Vue.prototype._init)
    !value._isVue
  ) {
    // 第一次实例化Observer
    ob = new Observer(value)
  }
  // asRootData传进来是true
  if (asRootData && ob) {
    // 如果是根数据则计数，后面Observer中的observe的asRootData非true
    ob.vmCount++
  }
  // observe 函数的返回值就是 ob (Observer实例函数)
  return ob
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
// 每个被观察到对象被附加上观察者实例，一旦被添加，观察者将为目标对象加上getter\setter属性，进行依赖收集以及调度更新。
export class Observer {
  // 三个实例属性
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data
 
  // 一个参数
  constructor (value: any) {
    // 实例对象的 value 属性引用了数据对象
    this.value = value
    // 在defineReactive已经实例过Dep; 此处的作用是对子对象或子数组childOb.dep.depend()、数组深层嵌套进行依赖收集e.__ob__.dep.depend()
    this.dep = new Dep()
    // 实例对象的 vmCount 属性被设置为 0
    this.vmCount = 0
    // 将Observer实例绑定到当前value的__ob__属性上面; 此处的作用是数组深层嵌套进行依赖收集e.__ob__.dep.depend()、数组操作触发依赖data.__ob__.dep.notify()
    /* 
      之所以这里使用 def 函数定义 __ob__ 属性是因为这样可以定义不可枚举的属性，
      这样后面遍历数据对象的时候就能够防止遍历到 __ob__ 属性
    */    
    def(value, '__ob__', this)
    // 对数组的监控
    if (Array.isArray(value)) {
      const augment = hasProto // 有__proto__属性方法
        ? protoAugment // 修改目标对象或数组：value.__proto__ = arrayMethods
        : copyAugment // 修改目标对象或数组：value.arrayKeys = arrayMethods.arrayKeys
      // 改变数组对象的原型指向 ( 目的是使数组在原型上含有7个数组操作的属性方法名，在对数组进行7个数组操作的时候可以触发收集的依赖 )
      augment(value, arrayMethods, arrayKeys)
      // 数组需要遍历每一个成员进行observe ( 数组可能嵌套数组或对象 )
      this.observeArray(value)
    } else {
      // walk 方法对对象数据data的属性循环调用 defineReactive 方法，
      // defineReactive 方法将数据data的属性转为访问器属性，并对数据进行递归观测
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  // 遍历data所有key值并且在它们上面绑定getter与setter
  walk (obj: Object) {
    // 获取对象属性所有可枚举的属性
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   */
  // 对数组的每一个成员进行observe (这种方法效率较低，所以优先使用第一种)
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
       // 数组需要遍历每一个成员进行observe(数组可能嵌套数组或对象)
      observe(items[i])
    }
  }
}

/**
 * Define a reactive property on an Object.
 */
// defineReactive函数的核心就是将数据对象的数据属性转换为访问器属性
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 在每一个属性下先实例一个依赖收集器
  const dep = new Dep()
  // 获取obj对象key键的属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 判断该字段是否是可配置的，如果不可配置 , 那么直接 return
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  /*  
    一个对象的属性很可能已经是一个访问器属性了，所以该属性很可能已经存在 get 或 set 方法。
    由于接下来会使用 Object.defineProperty 函数重新定义属性的 setter/getter，
    这会导致属性原有的 set 和 get 方法被覆盖，
    所以要将属性原有的 setter/getter 缓存，并在重新定义的 set 和 get 方法中调用缓存的函数，
    从而做到不影响属性的原有读写操作。
  */
  const getter = property && property.get
  const setter = property && property.set

  // 递归观测子属性(子属性是数组或者对象)
  // 一、数组：取值时触发childObj.dep依赖收集器，设置值时通过data.__ob__.dep触发收集的依赖: { a: [{ w: [1] }, [1], 3] }
  // 二、对象：通过当前作用域的实例dep = new Dep()触发依赖收集: { a: { w: 1 } }
  /* 
    默认就是深度观测。其实非深度观测的场景我们早就遇到过了，
    即 initRender 函数中在 Vue 实例对象上定义 $attrs 属性和 $listeners 属性时就是非深度观测
  */
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 如果 getter 存在那么直接调用该函数，并以该函数的返回值作为属性的值，保证属性的原有读取操作正常运作
      const value = getter ? getter.call(obj) : val
      // new Watch() -> Dep.target = new Watch() -> 取值触发get
      if (Dep.target) {
        // 在 get 中收集当前属性的依赖
        dep.depend()
        if (childOb) {
          // 对子属性进行依赖收集: (子属性是对象或数组的情况: { a: { w: 1 } }、{ a: [{ w: [1] }, [1], 3] })
          childOb.dep.depend()
          // 对子属性进行依赖收集: (子属性是数组深层嵌套的情况: { a: [{ w: [1] }, [1], 3] })
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      // 通过getter方法获取当前值，与新值进行比较，一致则不需要执行下面的操作
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 新旧值不等或者新旧值都是 NaN，等价于属性的值没有变化
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // initRender文件中customSetter 函数的作用，用来打印辅助信息，当然除此之外你可以将 customSetter 用在任何适合使用它的地方
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // 即如果属性原来拥有自身的 set 函数，那么应该继续使用该函数来设置属性的值，从而保证属性原有的设置操作不受影响
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 由于属性被设置了新的值，那么假如我们为属性设置的新值是一个数组或者纯对象，
      // 那么该数组或纯对象是未被观测的，所以需要对新值进行观测，
      // 这就是第一句代码的作用，同时使用新的观测对象重写 childOb 的值。
      // 当然了，这些操作都是在 !shallow 为真的情况下，即需要深度观测的时候才会执行。
      childOb = !shallow && observe(newVal)
      // dep对象通知所有的观察者【此dep是在当前访问器属性作用域内，与this.dep不同】
      dep.notify()
    }
  })
}

// helpers

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
// 数组深层嵌套依赖的收集(数组嵌套对象、数组嵌套数组)
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    // 成员是对象或者数组进行依赖收集: { w: 1 }、[{ w: [1] }, [1], 3]
    e && e.__ob__ && e.__ob__.dep.depend()
    // 成员是数组深层嵌套的情况：递归执行该方法继续深层依赖收集[{ w: [1] }, [1], 3]
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
// 修改目标对象或数组：改变其原型
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
// 修改目标对象或数组：拷贝
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// https://cn.vuejs.org/v2/api/#vm-set
/*
  向响应式对象中添加一个属性，并确保这个新属性同样是响应式的，且触发视图更新。
  它必须用于向响应式对象上添加新属性，因为 Vue 无法探测普通的新增属性 (比如 this.myObject.newProperty = 'hi')
  注意对象不能是 Vue 实例，或者 Vue 实例的根数据对象。
*/
export function set (target: Array<any> | Object, key: any, val: any): any {
  // target是数组：向target数组中插入val(索引为key)，同时返回此val
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 将数组的长度修改为 target.length 和 key 中的较大者，否则如果当要设置的元素的索引大于数组长度时 splice 无效
    target.length = Math.max(target.length, key)
    // 数组的 splice 变异方法能够完成数组元素的删除、添加、替换等操作。是能够触发响应的
    target.splice(key, 1, val)
    return val
  }
  // 已存在的属性是响应式的，将自动触发响应
  // https://github.com/vuejs/vue/issues/6845
  if (hasOwn(target, key)) {
    target[key] = val
    return val
  }

  // 以下是在给对象添加一个全新的属性
  // 定义了 ob 常量，它是数据对象 __ob__ 属性的引用
  const ob = (target: any).__ob__
  // _isVue 一个防止vm实例自身被观察的标志位 ，_isVue为true则代表vm实例，也就是this
  // vmCount判断是否为根节点，存在则代表是data的根节点，
  // Vue 不允许在已经创建的实例上动态添加新的根级响应式属性(root-level reactive property)
  if (target._isVue || (ob && ob.vmCount)) {
    /*  
      Vue 不允许在已经创建的实例上动态添加新的根级响应式属性(root-level reactive property)。
      https://cn.vuejs.org/v2/guide/reactivity.html#检测变化的注意事项
    */ 
    /*
      那么为什么不允许在根数据对象上添加属性呢？因为这样做是永远触发不了依赖的。
      原因就是根数据对象的 Observer 实例收集不到依赖(观察者)，如下：
      const data = {
        obj: {
          a: 1
          __ob__ // ob2
        },
        __ob__ // ob1
      }
      new Vue({
        data
      })
      如上代码所示，ob1 就是属于根数据的 Observer 实例对象，
      如果想要在根数据上使用 Vue.set/$set 并触发响应：
      Vue.set(data, 'someProperty', 'someVal')

      那么 data 字段必须是响应式数据才行，这样当 data 字段被依赖时，才能够收集依赖(观察者)到两个“筐”中(data属性自身的 dep以及data.__ob__)。
      这样在 Vue.set/$set 函数中才有机会触发根数据的响应。
      但 data 本身并不是响应的，这就是问题所在。
    */
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // target 也许原本就是非响应的，这个时候 target.__ob__ 是不存在的
  // 所以当发现 target.__ob__ 不存在时，就简单的赋值即可
  if (!ob) {
    target[key] = val
    return val
  }
  // 使用 defineReactive 函数设置属性值，这是为了保证新添加的属性是响应式的（this.value = value）
  defineReactive(ob.value, key, val)
  /*
    假设有如下数据对象：
    const data = {
      a: {
        b: 1
      }
    }

    该数据对象经过观测处理之后，将被添加 __ob__ 属性，如下：
    const data = {
      a: {
        b: 1,
        __ob__: {value: a, dep, vmCount}
      },
      __ob__: {value: data, dep, vmCount}
    }
    对于属性 a 来讲，访问器属性 a 的 setter/getter 通过闭包引用了一个 Dep 实例对象，即属性 a 用来收集依赖的“筐”。
    除此之外访问器属性 a 的 setter/getter 还闭包引用着 childOb，且 childOb === data.a.__ob__ 所以 childOb.dep === data.a.__ob__.dep。
    
    也就是说 childOb.dep.depend() 这句话的执行说明除了要将依赖收集到属性 a 自己的“筐”里之外，
    还要将同样的依赖收集到 data.a.__ob__.dep 这里”筐“里，为什么要将同样的依赖分别收集到这两个不同的”筐“里呢？
    其实答案就在于这两个”筐“里收集的依赖的触发时机是不同的，即作用不同，两个”筐“如下：

      第一个”筐“是 dep
      第二个”筐“是 childOb.dep

    第一个”筐“里收集的依赖的触发时机是当属性值被修改时触发，即在 set 函数中触发：dep.notify()。
    而第二个”筐“里收集的依赖的触发时机是在使用 $set 或 Vue.set 给数据对象添加新属性时触发，
    我们知道由于 js 语言的限制，在没有 Proxy 之前 Vue 没办法拦截到给对象添加属性的操作。
    所以 Vue 才提供了 $set 和 Vue.set 等方法让我们有能力给对象添加新属性的同时触发依赖，那么触发依赖是怎么做到的呢？就是通过数据对象的 __ob__ 属性做到的。
    因为 __ob__.dep 这个”筐“里收集了与 dep 这个”筐“同样的依赖。ob.dep.notify()

    假设 Vue.set 函数代码如下：
    Vue.set = function (obj, key, val) {
      defineReactive(obj, key, val)
      obj.__ob__.dep.notify()
    }

    如上代码所示，当我们使用上面的代码给 data.a 对象添加新的属性：
    Vue.set(data.a, 'c', 1)

    上面的代码之所以能够触发依赖，就是因为 Vue.set 函数中触发了收集在 data.a.__ob__.dep 这个”筐“中的依赖：
    Vue.set = function (obj, key, val) {
      defineReactive(obj, key, val)
      obj.__ob__.dep.notify() // 相当于 data.a.__ob__.dep.notify()
    }

    Vue.set(data.a, 'c', 1)
    所以 __ob__ 属性以及 __ob__.dep 的主要作用是为了添加、删除属性时有能力触发依赖，而这就是 Vue.set 或 Vue.delete 的原理。
    */
  // 调用 __ob__.dep.notify() 从而触发响应
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
/*
删除对象的属性。如果对象是响应式的，确保删除能触发更新视图。
这个方法主要用于避开 Vue 不能检测到属性被删除的限制，但是你应该很少会使用它。
目标对象不能是一个 Vue 实例或 Vue 实例的根数据对象。
*/
export function del (target: Array<any> | Object, key: any) {
  // 数组的 splice 变异方法能够完成数组元素的删除、添加、替换等操作。是能够触发响应的
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  // 获得target的Oberver实例
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    /*  
      Vue 不允许删除实例上的根级响应式属性(root-level reactive property)。
      https://cn.vuejs.org/v2/guide/reactivity.html#检测变化的注意事项
    */
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  // target中无此key
  if (!hasOwn(target, key)) {
    return
  }
  // 删除target中key的属性
  delete target[key]
  // 判断 ob 对象是否存在，如果不存在说明 target 对象原本就不是响应的，所以直接返回(return)即可
  if (!ob) {
    return
  }
  // 如果 ob 对象存在，说明 target 对象是响应的，需要触发响应才行，即执行 ob.dep.notify()
  ob.dep.notify()
}
