/* @flow */

import { warn } from './debug'
import { observe, observerState } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};
// 验证prop,不存在用默认值替换，类型为bool则声称true或false，
// 当使用default中的默认值的时候会将默认值的副本进行observe
export function validateProp (
  key: string, // prop的key值
  propOptions: Object, // prop对象，https://cn.vuejs.org/v2/guide/components.html#Prop-验证
  propsData: Object, // props数据
  vm?: Component // Vue实例
): any {
  // 获取props对象属性为key的prop对象
  const prop = propOptions[key]
  // 是否通过Vue.extend创建prop为key的属性，是的话absent为false，反之为true
  const absent = !hasOwn(propsData, key)
  // 获得Vue.extend创建的prop为key的属性值
  let value = propsData[key]
  // handle boolean props
  // 处理Boolean类型的prop属性
  if (isType(Boolean, prop.type)) {
    // 通过Vue.extend创建prop为key的属性，并且当前prop也没有default属性，将此prop赋值为false
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } 
    // 当前prop的type属性不是Strig类型，并且通过Vue.extend创建的prop为key的属性值为空 或者 与 当前prop的key值驼峰拼接相等
    else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      value = true
    }
  }
  // check default value
  // 未通过Vue.extend创建prop为key的属性值
  if (value === undefined) {
    // 获取属性的默认值
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    // 由于默认值是一份新的拷贝副本，确保已经对它进行observe，有观察者观察它的变化。
    // 把之前的shouldConvert保存下来，当observe结束以后再设置回来
    const prevShouldConvert = observerState.shouldConvert
    observerState.shouldConvert = true
    // 对prop的默认value值进行响应式检测
    observe(value)
    observerState.shouldConvert = prevShouldConvert
  }
  // 非生产环境判断属性pro是否合法有效
  if (process.env.NODE_ENV !== 'production') {
    assertProp(prop, key, value, vm, absent)
  }
  // 返回prop的值
  return value
}

/**
 * Get the default value of a prop.
 */
// 获取属性的默认值
/*props设置形式：https://www.jb51.net/article/141749.htm
复杂对象形式的情况下，作为对象属性的参数可以写为对象形式，参数对象含有4个属性，type、required、default、validator。
type：设定参数类型，当传入参数类型与type不相符时，控制台会报错
required：设定参数是否是必传，当设为true时，不传该参数会报错
default：设定默认值，当参数类型为复杂类型时，需使用工厂模式生成默认值，否则Vue会在控制台抛出警告。如图所示，就通过工厂模式生成了一个长度为3的空数组。
validator：校验器，是一个函数，拥有一个代表传入值的形参，可以自定义各种校验，当返回false时，会报错，表示没通过校验。
*/
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  // 当前prop没有默认值的时候直接返回undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 非生产环境下，默认值是对象的话发出警告
  // 因为prop为 对象/数组 默认值的话必须通过函数返回
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 以前的prop渲染的值如果不是undefined的，则返回上一次的默认值用以避免触发非必要的观察者
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined // 之前的渲染的值不是undefined的话，返回上一次的值
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // prop.default是funtion，并且prop.type不是Function，则改变prop.default的上下文环境为vm
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
// 判断属性prop是否合法有效(type + validator)
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  // 当前prop存在required，并且没有通过Vue.extend创建prop为key的属性
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  // 未通过Vue.extend创建prop为key的属性值，并且当前prop不存在required属性
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    // 当前prop的type不是数组
    if (!Array.isArray(type)) {
      type = [type]
    }
    // 当前prop的type是数组
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  // prop值的类型与prop.type不一样
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` + // prop的名称
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` + //  prop的default的type类型
      `, got ${toRawType(value)}.`, //  prop现在的类型
      vm
    )
    return
  }
  // prop值没有通过prop.validator校验
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}
// 判断当前prop的值是否属于指定的类型
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  // 获取prop.type
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) { // (String|Number|Boolean|Function|Symbol)
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    // 不合法但是value值时原始包装对象
    if (!valid && t === 'object') { // Number\Boolean
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') { // 对象 
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') { // 数组
    valid = Array.isArray(value)
  } else { // value是否是type的实例
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
// 使用函数字符串名称检查内置类型，
// 因为在跨不同的vms / iframes运行时，简单的相等检查将失败。
// 当fn为 (String|Number|Boolean|Function|Symbol) 时，直接返回类型
function getType (fn) {
  // \s指的是匹配一个不可见原子，\w匹配任意一个数组、字母、下划线
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  // 返回匹配的fn的函数名称
  return match ? match[1] : ''
}

// 判断fn是否是type类型
function isType (type, fn) {
  // fn不是数组
  if (!Array.isArray(fn)) {
    // 注意：Boolean.toString() === "function Boolean() { [native code] }"
    return getType(fn) === getType(type)
  }
  // fn是数组
  for (let i = 0, len = fn.length; i < len; i++) {
    if (getType(fn[i]) === getType(type)) {
      return true
    }
  }
  /* istanbul ignore next */
  return false
}
