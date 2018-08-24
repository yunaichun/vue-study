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
 // 默认情况下，当一个无效的属性被设置时，新的值也会被转换成无效的。
 // 不管怎样当传递props时，我们不需要进行强制转换
export const observerState = {
  shouldConvert: true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
// 每个被观察到对象被附加上观察者实例，一旦被添加，观察者将为目标对象加上getter\setter属性，进行依赖收集以及调度更新。
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    // 在defineReactive已经实例过Dep; 此处的作用是对子对象或子数组childOb.dep.depend()、数组深层嵌套进行依赖收集e.__ob__.dep.depend()
    this.dep = new Dep()
    this.vmCount = 0
    // 将Observer实例绑定到当前value的__ob__属性上面; 此处的作用是数组深层嵌套进行依赖收集e.__ob__.dep.depend()、数组操作触发依赖data.__ob__.dep.notify()
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
  // 检测对象：遍历data所有key值并且在它们上面绑定getter与setter
  // 这个方法只有在value的类型是对象的时候才能被调用
  walk (obj: Object) {
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

// helpers

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
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 尝试创建一个Observer实例（__ob__），如果成功创建Observer实例则返回新的Observer实例，
// 如果已有Observer实例则返回现有的Observer实例。
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 已经存在observer实例
    ob = value.__ob__
  } else if (
    // 这里的判断是为了确保value是单纯的对象，而不是函数或者是Regexp等情况
    observerState.shouldConvert &&
    !isServerRendering() && // 不是服务端渲染
    (Array.isArray(value) || isPlainObject(value)) && //是数组或者对象
    Object.isExtensible(value) &&
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
  // 返回new Observer(data)实例函数
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// defineReactive(data, keys[i], data[keys[i]])
// 将数据对象data的属性转换为访问器属性
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
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 如果之前该对象已经预设了getter以及setter函数则将其取出来，新定义的getter/setter中会将其执行，
  // 保证不会覆盖之前已经定义的getter/setter。
  const getter = property && property.get
  const setter = property && property.set

  // 递归观测子属性(子属性是数组或者对象)
  // 一、数组：取值时触发childObj.dep依赖收集器，设置值时通过data.__ob__.dep触发收集的依赖: { a: [{ w: [1] }, [1], 3] }
  // 二、对象：通过当前作用域的实例dep = new Dep()触发依赖收集: { a: { w: 1 } }
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 如果原本对象拥有getter方法则执行
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
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        // 如果原本对象拥有setter方法则执行setter
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 新的值需要重新进行observe，保证数据响应式
      childOb = !shallow && observe(newVal)
      // dep对象通知所有的观察者【此dep是在当前访问器属性作用域内，与this.dep不同】
      dep.notify()
    }
  })
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
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    // 因为数组不需要进行响应式处理，数组会修改七个Array原型上的方法来进行响应式处理
    return val
  }
  // target是对象target中含有此key：替换此target索引为key的值为val，同时返回此val
  if (hasOwn(target, key)) {
    target[key] = val
    return val
  }
  // 获得target的Oberver实例
  const ob = (target: any).__ob__
  // _isVue 一个防止vm实例自身被观察的标志位 ，_isVue为true则代表vm实例，也就是this
  // vmCount判断是否为根节点，存在则代表是data的根节点，
  // Vue 不允许在已经创建的实例上动态添加新的根级响应式属性(root-level reactive property)
  if (target._isVue || (ob && ob.vmCount)) {
    /*  
      Vue 不允许在已经创建的实例上动态添加新的根级响应式属性(root-level reactive property)。
      https://cn.vuejs.org/v2/guide/reactivity.html#检测变化的注意事项
    */
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // target数据未被观测过：data.__ob__ = new Observer()
  if (!ob) {
    target[key] = val
    return val
  }
  // 为对象defineProperty上在变化时通知的属性（this.value = value）
  defineReactive(ob.value, key, val)
  // 手动通知观察者：target增加了某属性值
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
  // target是数组：向target数组中删除索引为key的值
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
  // target未被观测过：data.__ob__ = new Observer()
  if (!ob) {
    return
  }
  // 手动通知观察者：target删除了某属性值
  ob.dep.notify()
}

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
