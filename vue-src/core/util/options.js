/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
// 合并父子选项值为最终值的策略对象，此时 strats 是一个空对象，
// 因为 config.optionMergeStrategies = Object.create(null)
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
// 开发环境starts的限制
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    // 如果vue没有实例的情况
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

// strats上钩子函数的合并策略
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})
/**
 * Hooks and props are merged as arrays.
 */
// strats上钩子函数的合并策略
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  return childVal // child options上存在该属性
    ? parentVal // child options上存在该属性, parent options上存在该属性
      ? parentVal.concat(childVal)
      : Array.isArray(childVal) // child options上存在该属性, parent options上不存在该属性
        ? childVal 
        : [childVal]
    : parentVal // child options上不存在该属性
}

/**
 * Other object hashes.
 */
// strats上props、methods、inject、computed的合并策略
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 如果child options上这些属性存在，则先判断它们是不是对象。
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 如果parent options上没有该属性，则直接返回child options上的该属性
  if (!parentVal) return childVal

  // 如果parent options和child options都有，则合并parent options和child 
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}

//  strats上directives、components、filters的合并策略
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})
/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
//  strats上directives、components、filters的合并策略
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  // 如果child options上这些属性存在，合并parent options
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

// strats上data的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 没有实例vue
  if (!vm) {
    // childVal必须是函数
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      return parentVal
    }
    // strats.data 方法最终会返回一个函数：mergedInstanceDataFn
    return mergeDataOrFn.call(this, parentVal, childVal)
  }
  // strats.data 方法最终会返回一个函数：mergedInstanceDataFn
  return mergeDataOrFn(parentVal, childVal, vm)
}

// strats上provide的合并策略
strats.provide = mergeDataOrFn

/**
 * Data
 */
// strats上data、provide的合并策略
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 当前调用mergeOptions操作的不是vm实例（即通过Vue.extend/Vue.component调用了mergeOptions方法）
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    // 在这种情况下，其处理逻辑也是类似的。
    // 如果当前实例options或者构造函数options上有一个没有data属性，则返回另一个的data属性，
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    // 如果两者都有，则同样调用mergeData方法处理合并。
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this) : parentVal
      )
    }
  } 
  // 有实例vue
  else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      // 实例中的data
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      // 构造函数中的data
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : parentVal
      // 如果新建实例时传入的child options上有data属性，
      // 则调用mergeData方法合并实例上的data属性和其构造函数options上的data属性
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      }
      // 如果新建实例时传入的child options上没有data属性，
      // 则返回构造函数中的data
      else {
        return defaultData
      }
    }
  }
}
/**
 * Helper that recursively merges two data objects together.
 */
// strats上data、provide的合并策略（to是child，from是parent）
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    // 如果from对象中有to对象里没有的属性，则调用set方法（这里的set就是Vue.$set）
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } 
    // 如果from和to中有相同的key值，且key对应的value是对象，则会递归调用mergeData方法，
    // 否则以to的值为准，最后返回to对象
    else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  // 最后将parent  options都合并到child options中了
  return to
}

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
// strats上watch的合并策略
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  // 火狐浏览器在对象原型中有一个watch函数
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  // 如果child options上这些属性不存在
  if (!childVal) return Object.create(parentVal || null)
  // 判断vm上的childVal是不是对象
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // 如果parent options上这些属性不存在
  if (!parentVal) return childVal

  // 如果parent options上这些属性存在
  const ret = {}
  extend(ret, parentVal)
  // 遍历childVal
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    // parent存在且为非数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent // parent存在
      ? parent.concat(child) // 合并parent和child
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

// 判断vm上的value是不是对象
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}


/**
 * Default strategy.
 */
// defaultStrat的逻辑是，如果child上该属性值存在时，就取child上的该属性值，
// 如果不存在，则取parent上的该属性值
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}


/**
 * Validate component names
 */
// 验证组件注册的名称是否正确
function checkComponents (options: Object) {
  for (const key in options.components) {
    const lower = key.toLowerCase()
    // components的name为slot和component（不分大小写），或者component名称是html 保留标签和部分 SVG 保留标签
    if (isBuiltInTag(lower) || config.isReservedTag(lower)) {
      warn(
        'Do not use built-in or reserved HTML elements as component ' +
        'id: ' + key
      )
    }
  }
}
/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
/*
  法一：
    const ChildComponent = {
      props: ['someData']
    }
  法二：
    const ChildComponent = {
      props: {
        someData: {
          type: Number,
          default: 0
        }
      }
    }
*/
// 将options中的props属性转换成对象的形式
// 因为props有些传入的时候可能会是数组的形式
function normalizeProps (options: Object, vm: ?Component) { // options为实例化时传入的options, vm是Vue实例
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  // props是数组的情况：props: ['postTitle']
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        // 将prop属性名称转成驼峰形式 a_b  => aB
        name = camelize(val)
        // props: ['postTitle']  =>  { postTitle: { type: null } }
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } 
  // props是对象：props: { propC: { type: String, required: true } }
  else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      // 将prop属性名称转成驼峰形式 a_b  => aB
      name = camelize(key)
      res[name] = isPlainObject(val) // 是对象
        ? val // 直接返回
        : { type: val } // 只取type
    }
  } 
  // props不是对象和数组，开发环境报错
  else if (process.env.NODE_ENV !== 'production' && props) {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  // 生成封装后的props
  options.props = res
}
/**
 * Normalize all injections into Object-based format
 */
/*
    子组件法一：
      const ChildComponent = {
        template: '<div>child component</div>',
        created: function () {
          // 这里的 data 是父组件注入进来的
          console.log(this.data)
        },
        inject: ['data']
      }

    子组件法二：
    const ChildComponent = {
      template: '<div>child component</div>',
      created: function () {
        console.log(this.d)
      },
      // 对象的语法类似于允许我们为注入的数据声明一个别名
      inject: {
        d: 'data'
      }
    }


    父组件：
      var vm = new Vue({
        el: '#app',
        // 向子组件提供数据
        provide: {
          data: 'test provide'
        },
        components: {
          ChildComponent
        }
      })
*/
// 将options中的inject属性转换成对象的形式
// 因为inject有些传入的时候可能会是数组的形式
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  const normalized = options.inject = {}
  // inject是数组的情况：inject: ['postTitle']
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      // inject: ['foo'] => { foo: { from: 'foo'} }
      normalized[inject[i]] = { from: inject[i] }
    }
  } 
  // inject是对象：inject: { foo: { from: 'bar', default: 'foo' } }
  else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)  // 是对象
        ? extend({ from: key }, val)  // 直接返回
        : { from: val } // 只取from
    }
  } 
  // inject不是对象和数组，开发环境报错
  else if (process.env.NODE_ENV !== 'production' && inject) {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}
/**
 * Normalize raw function directives into object format.
 */
/* 将options中的directives属性转换成对象的形式
    <div id="app" v-test1 v-test2>{{test}}</div>

    var vm = new Vue({
      el: '#app',
      data: {
        test: 1
      },
      // 注册两个局部指令
      directives: {
        test1: {
          bind: function (el, binding) {
            console.log('v-test1')
          }
        },
        test2: function () {
          console.log('v-test2')
        }
      }
    })
*/
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      // 获取指令函数值
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
// 合并两个options对象,并生成一个新的对象。
// 是实例化和继承中使用的核心方法。
export function mergeOptions (
  parent: Object, // 构造函数上的options
  child: Object, // 实例化时传入的options
  vm?: Component // vm实例本身
): Object {
  if (process.env.NODE_ENV !== 'production') {
    // 验证组件注册的名称是否正确
    checkComponents(child)
  }
  // 如果child是function类型的话，我们取其options属性作为child
  if (typeof child === 'function') {
    child = child.options
  }
  // 分别是把options中的props,inject,directives属性转换成对象的形式
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)




  // 当传入的options里有extends属性时，
  // 再次调用mergeOptions方法合并extends里的内容到实例的构造函数options上（即parent options）
  /*
    const childComponent = Vue.component('child', {
        ...
        mixins: [myMixin],
        extends: myComponent
        ...
    })
    const myMixin = {
        created: function () {
          this.hello()
        },
        methods: {
          hello: function () {
            console.log('hello from mixin')
        }
      }
    }
    const myComponent = {
        mounted: function () {
          this.goodbye()
        },
        methods: {
          goodbye: function () {
            console.log('goodbye from mixin')
          }
       }
    }
    就会把传入的mounted, created钩子处理函数，
    还有methods方法提出来去和parent options做合并处理。
  */
  /*
    // 创建构造器
    var Profile = Vue.extend({
      template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
      data: function () {
        return {
          firstName: 'Walter',
          lastName: 'White',
          alias: 'Heisenberg'
        }
      }
    })
    // 创建 Profile 实例，并挂载到一个元素上。
    new Profile().$mount('#mount-point')


    // 为自定义的选项 'myOption' 注入一个处理器。
    Vue.mixin({
      created: function () {
        var myOption = this.$options.myOption
        if (myOption) {
          console.log(myOption)
        }
      }
    })
    new Vue({
      myOption: 'hello!'
    }) // => "hello!"
  */
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  // 当传入的options里有mixin属性时，
  // 再次调用mergeOptions方法合并mixins里的内容到实例的构造函数options上（即parent options）
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }




  // 变量options存储合并之后的options，
  const options = {}
  // 变量key存储parent options和child options上的key值。
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }

  // 合并策略
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
