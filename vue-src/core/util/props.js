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

/**
 * [validateProp 返回给定名字的 prop 的值]
 * @param  {[type]} key:         string        [prop 的名字]
 * @param  {[type]} propOptions: Object        [整个 props 选项对象]
 * @param  {[type]} propsData:   Object        [整个 props 数据来源对象]
 * @param  {[type]} vm?:         Component     [组件实例对象]
 * @return {[type]}              [返回给定名字的 prop 的值]
 */
/*
  假如我们定义了如下组件：
  {
    name: 'someComp',
    props: {
      prop1: String
    }
  }

  并像如下代码这样使用：
  <some-comp prop1="str" />

  那么 validateProp 函数接收的四个参数将会是：
  一、props 的名字
      key = 'prop1'
  二、props 选项参数
      propOptions = {
        prop1: {
          type: String
        }
      }
  三、props 数据
      propsData = {
        prop1: 'str'
      }
  四、组件实例对象
      vm = vm
*/
export function validateProp (
  key: string, // prop的key值
  propOptions: Object, // prop对象，https://cn.vuejs.org/v2/guide/components.html#Prop-验证
  propsData: Object, // props数据
  vm?: Component // Vue实例
): any {
  /* 名字为 key 的 props 的定义 */
  const prop = propOptions[key]
  /* 代表对应的 prop 在 propsData 上是否有数据，或者换句话说外界是否传递了该 prop 给组件。如果 absent 为真，则代表 prop 数据缺失。*/
  const absent = !hasOwn(propsData, key)
  /* 代表通过读取 propsData 得到的，当然了如果外界没有向组件传递相应的 prop 数据，那么 value 就是 undefined */
  let value = propsData[key]
 
  // handle boolean props
  /*处理Boolean类型的props
    一、首先 getTypeIndex 函数接收两个参数，这两个参数都是某一个类型数据结构的构造函数，
        它可以是 javascript 原生数据类型的构造函数，也可以是自定义构造函数。

    二、isType 函数的作用准确地说是用来查找第一个参数所指定的类型构造函数是否存在于第二个参数所指定的类型构造函数数组中，
        没错第二个参数可能是一个数组，比如我们像如下这样定义 props：
          props: {
            prop1: [Number, String]
          }
     
    三、那么经过规范化后 propOptions 将是：
        propOptions = {
          prop1: {
            type: [Number, String]
          }
        }
  */
  if (isType(Boolean, prop.type)) {
    /* 
      一、外界没有向组件传递该 prop，所以如上条件所代表的意思是：外界没有为组件传递该 prop，但是组件中却使用了该 prop，并且未指定默认值；如下：
          1、父组件
             <some-comp/>
          2、子组件
              new Vue({
                name: 'child',
                props: {
                  prop1: {
                    type: Boolean
                  }
                }
              })
      二、在这种情况下如果你指定该 prop 的类型为 Boolean，那么 Vue 会自动将该 prop 的值设置为 false
    */
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } 
    /*
      如果 absent 为假，说明外界向组件传递了该 prop；
      一、props中不存在String类型，假如存在String类型，由于已经存在Boolean类型；所以还要判断String类型优先级与Boolean优先级哪一个比较高
      二、外界向组件传递的 prop 要么是一个空字符串
      三、要么就是一个名字由驼峰转连字符后与值为相同字符串的 prop如下：
          1、<!-- 值为空字符串 -->
             <some-comp prop1="" />
             <!-- 等价于 -->
             <some-comp prop1 />
          2、<!-- 名字由驼峰转连字符后与值为相同字符串 -->
             <some-comp someProp="some-prop" />
    */
    else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      value = true
    }
  }

  // check default value
  /*处理不传默认值的情况，如下：
    <!-- 值为空字符串 -->
    <some-comp prop1="" />
    <!-- 等价于 -->
    <some-comp prop1 />
  */
  if (value === undefined) {
    /*
      这段代码用来检测该 prop 的值是否是 undefined，我们知道 prop 是可以指定默认值的，
      当外界没有为组件传递该 prop 时，则取默认值作为该 prop 的数据。
      根据如上代码可知获取默认值的操作由 getPropDefaultValue 函数来完成，并将获取到的默认值重新赋值给 value 变量
    */
    value = getPropDefaultValue(vm, prop, key)

    // since the default value is a fresh copy,
    // make sure to observe it.
    /*
      一、首先使用 prevShouldObserve 常量保存了之前的 shouldObserve 状态，
      二、紧接着将开关开启，使得 observe 函数能够将 value 定义为响应式数据，
      三、最后又还原了 shouldObserve 的状态。
      原因：之所以这么做是因为取到的默认值是非响应式的，我们需要将其重新定义为响应式数据。
    */
    const prevShouldConvert = observerState.shouldConvert
    observerState.shouldConvert = true
    observe(value)
    observerState.shouldConvert = prevShouldConvert
  }

  // 非生产环境判断属性pro是否合法有效
  if (process.env.NODE_ENV !== 'production') {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * [isType 查找第一个参数所指定的类型构造函数是否存在于第二个参数所指定的类型构造函数数组中]
 * @param  {[type]}   type [指定的类型构造函数]
 * @param  {Function} fn   [指定的类型构造函数数组]
 * @return {Boolean}       [返回true或false]
 */
function isType (type, fn) {
  // fn不是数组
  if (!Array.isArray(fn)) {
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

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
/**
 * [getType 返回fn的类型，用字符串表示出来]
 * @param  {Function} fn [指定的类型构造函数]
 * @return {[type]}      [返回fn属于什么类型]
 */
/* 
  getType(Boolean) === 'Boolean'
  一、注释的意思是简单的类型之间直接比较在不同的 iframes / vms 之间是不管用的，
      我们回想一下如何判断一个数据是否是数组的方法，其中一个方法就是使用 instanceof 操作符：
        someData instanceof Array

  二、这种方式的问题就在于，不同 iframes 之间的 Array 构造函数本身都是不相等的。
      所以以上判断方法只适用于在同一个 iframes 环境下。

  三、当fn为 (String|Number|Boolean|Function|Symbol) 时，直接返回类型
*/
function getType (fn) {
  /*  
    \s指的是匹配一个不可见原子，\w匹配任意一个数组、字母、下划线
    Boolean.toString() === "function Boolean() { [native code] }"
  */
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  // 返回fn属于的类型
  return match ? match[1] : ''
}

/**
 * Get the default value of a prop.
 */
/**
 * [getPropDefaultValue 获取props为key默认default值]
 * @param  {[type]} vm:   ?Component    [Vue实例]
 * @param  {[type]} prop: PropOptions   [options中props配置项]
 * @param  {[type]} key:  string        [props对象中为key的属性]
 * @return {[type]}       [返回默认prop的默认default值]
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  /*当前prop没有默认值的时候直接返回undefined*/
  if (!hasOwn(prop, 'default')) {
    return undefined
  }

  const def = prop.default
  // warn against non-factory defaults for Object & Array
  /* default是对象或数组的情况处理
    一、在非生产环境下，如果你的 prop 默认值是对象类型，那么则会打印警告信息，告诉你需要用一个工厂函数返回这个对象类型的默认值，比如：
        props: {
          prop1: {
            default: {
              a: 1
            }
          },
          prop2: {
            default: [1, 2, 3]
          }
        }

    二、如上代码定义了两个 prop，其中 prop1 的默认值是一个对象，prop2 的默认值是一个数组，这两个 prop 都是不合法的，
        你需要用工厂函数将默认值返回，如下：
        props: {
          prop1: {
            default () {
              return {
                a: 1
              }
            }
          },
          prop2: {
            default () {
              return [1, 2, 3]
            }
          }
        }

    三、这么做的目的是防止多个组件实例共享一份数据所造成的问题。
  */
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
  /* 组件更新时没传递prop属性：<some-comp prop1="" />
    一、代码既然已经执行到了 getPropDefaultValue 函数那么说明外界没有向组件传递该 prop 数据，
        那也就是说 vm.$options.propsData[key] 很显然的应该是 undefined。
    二、为什么还需要如上判断呢？实际上事情并非像我们想象的那样。
        这是因为 组件第一次创建与后续的更新走的是两套不太一致的逻辑。
    三、为了证明这一点，我们需要打开 src/core/instance/lifecycle.js 文件找到 updateChildComponent 函数

    所以：
    1、条件 vm.$options.propsData[key] === undefined 说明上一次组件更新或创建时外界就没有向组件传递该 prop 数据
    2、条件 vm._props[key] !== undefined 说明该 prop 存在非未定义的默认值
    所以如上 if 条件成立则说明：
    1、当前组件处于更新状态，且没有传递该 prop 数据给组件
    2、上一次更新或创建时外界也没有向组件传递该 prop 数据
    3、上一次组件更新或创建时该 prop 拥有一个不为 undefined 的默认值
    
    原因：
    一、那么此时应该返回之前的 prop 值(即默认值)作为本次渲染该 prop 的默认值。
        这样就能避免触发没有意义的响应。为什么能避免触发无意义的响应呢？
        很简单，假设每次都重新获取默认值而不是返回之前的默认值，那么如下 prop 的默认值将总是会变化的：
          props: {
            prop1: {
              default () {
                return { a: 1 }
              }
            }
          }
    二、由于 prop1 的默认值是由工厂函数返回的对象，这个对象每次都是不同的，
        即使看上去数据是一样的，但他们具有不同的引用，这样每次都会触发响应，但视图并没有任何变化，
        也就是说触发了没有意义的响应。而解决办法就是前面所介绍的，返回上一次的默认值就可以了。
 */
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }

  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return typeof def === 'function' && getType(prop.type) !== 'Function' // default可能是工厂函数
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
/**
 * [assertProp 对 props 的类型做校验]
 * @param  {[type]} prop:   PropOptions   [整个 props 选项对象]
 * @param  {[type]} name:   string        [该 prop 的key名称]
 * @param  {[type]} value:  any           [该 prop 的值]
 * @param  {[type]} vm:     ?Component    [vue实例]
 * @param  {[type]} absent: boolean       [外界是否传递了该 prop 给组件]
 * @return {[type]}         [没有返回]
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  /* 
    该 prop 为必传 prop，但是外界却没有向组件传递该 prop 的值。
    此时需要打印警告信息提示开发者缺少必传的 prop
  */
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }

  /*
    value 值为 null 或 undefined，并且该 prop 是非必须的，
    在这种情况下就不需要做后续的校验了
  */
  if (value == null && !prop.required) {
    return
  }

  let type = prop.type
  /*代表着类型校验成功与否，!type 说明如果开发者在定义 prop 时没有规定该 prop 值的类型，则不需要校验*/
  let valid = !type || type === true
  /*它的初始值为空数组，该常量用来保存类型的字符串表示，当校验失败时会通过打印该数组中收集的类型来提示开发者应该传递哪些类型的数据。*/
  const expectedTypes = []
  if (type) {
    /*检测 type 是否是一个数组，如果不是数组则将其包装成一个数组*/
    if (!Array.isArray(type)) {
      type = [type]
    }
    /*遍历type数组
      一旦某个类型校验通过，那么 valid 的值将变为真，此时 for 循环内的语句将不再执行，
      这是因为该 prop 值的类型只要满足期望类型中的一个即可
    */
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  /*假设 for 循环遍历结束之后 valid 变量依然为假，则说明该 prop 值的类型不在期望的类型之中*/
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` + // prop的名称
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` + //  prop的default的type类型
      `, got ${toRawType(value)}.`, //  prop现在的类型
      vm
    )
    return
  }

  /*
    我们知道在定义 prop 时可以通过 validator 属性指定一个校验函数实现自定义校验，该函数的返回值作为校验的结果。
    实际上在 Vue 内部实现非常简单，如上代码所示，定义了 validator 常量，它的值就是开发者定义的 prop.validator 函数，
    接着只需要调用该函数并判断其返回值的真假即可，如果返回值为假说明自定义校验失败，
    则直接打印警告信息提示开发者该 prop 自定义校验失败即可。
  */
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


/**
 * [assertType 判断当前prop的值是否属于指定的类型]
 * @param  {[type]} value: any           [prop 的值 value]
 * @param  {[type]} type:  Function      [prop 的类型 type]
 * @return {[type]}        [返回对象如下注释]
 */
/* 
  {
    expectedType: 'String',
    valid: true
  } 
*/
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  /*通过 getType 函数获取到的类型字符串表示*/
  const expectedType = getType(type)
  /*一、基本类型
    期望的类型为以下五种类型之一：'String'、'Number'、'Boolean'、'Function' 以及 'Symbol'
  */
  if (simpleCheckRE.test(expectedType)) {
    /*基本类型可以通过typeof操作符进行区分判断*/
    const t = typeof value
    /*全等说明该 prop 的实际值类型与期望类型相同，此时 valid 将会为真*/
    valid = t === expectedType.toLowerCase()

    // for primitive wrapper objects
    /* 判断 value 是否是 type 的实例，如果是则依然认为该 prop 值是有效的
      大家注意如果上面的 if 语句条件为真，则我们能够确定以下几点：
        1、期望的类型是这五种类型之一：'String'、'Number'、'Boolean'、'Function' 以及 'Symbol'
        2、并且通过 typeof 操作符取到的该 prop 值的类型为 object
      这时我们能够否定 prop 的值不符合预期吗？答案是不能的，
      因为在 javascript 有个概念叫做 基本包装类型，比如可以这样定义一个字符串：
        const str = new String('基本包装类型')

      此时通过 typeof 获取 str 的类型将得到 'object' 字符串。
      但 str 的的确确是一个字符串，所以在这种情况下我们还需要做进一步的检查，即如下判断：
    */
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  }
  /*二、引用类型-对象*/
  else if (expectedType === 'Object') { 
    valid = isPlainObject(value)
  }
  /*三、引用类型-数组*/
  else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } 
  /*四、自定义类型
    此时说明开发者在定义 prop 时所指定的期望类型为自定义类型，如：

    // 自定义类型构造函数
    function Dog () {}

    props: {
      prop1: {
        type: Dog
      }
    }
    对于自定义类型，只需要检查值是否为该自定义类型构造函数的实例即可。
  */
  else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}
