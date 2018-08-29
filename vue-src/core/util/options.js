/* @flow */

/*
  对于 el、propsData 选项使用默认的合并策略 defaultStrat。
  对于 data 选项，使用 mergeDataOrFn 函数进行处理，最终结果是 data 选项将变成一个函数，且该函数的执行结果为真正的数据对象。
  对于 生命周期钩子 选项，将合并成数组，使得父子选项中的钩子函数都能够被执行
  对于 directives、filters 以及 components 等资源选项，父子选项将以原型链的形式被处理，正是因为这样我们才能够在任何地方都使用内置组件、指令等。
  对于 watch 选项的合并处理，类似于生命周期钩子，如果父子选项都有相同的观测字段，将被合并为数组，这样观察者都将被执行。
  对于 props、methods、inject、computed 选项，父选项始终可用，但是子选项会覆盖同名的父选项字段。
  对于 provide 选项，其合并策略使用与 data 选项相同的 mergeDataOrFn 函数。
  最后，以上没有提及到的选项都将使默认选项 defaultStrat。
  最最后，默认合并策略函数 defaultStrat 的策略是：只要子选项不是 undefined 就使用子选项，否则使用父选项。
*/

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
// 
/*
  Vue.config.optionMergeStrategies.customOption = function (parentVal, childVal) {
      return parentVal ? (parentVal + childVal) : childVal
  }
  如上代码中，我们添加了自定义选项 customOption 的合并策略，其策略为：如果没有 parentVal 则直接返回 childVal，否则返回两者的和。
  所以如下代码：

  // 创建子类
  const Sub = Vue.extend({
      customOption: 1
  })
  // 以子类创建实例
  const v = new Sub({
      customOption: 2,
      created () {
          console.log(this.$options.customOption) // 3
      }
  })
  最终，在实例的 created 方法中将打印为数字 3。上面的例子很简单，没有什么实际作用，但这为我们提供了自定义选项的机会，这其实是非常有用的。
*/
// 合并父子选项值为最终值的策略对象，此时 strats 是一个空对象，因为 config.optionMergeStrategies = Object.create(null)
const strats = config.optionMergeStrategies



/**
 * Options with restrictions
 */
// 选项 el、propsData 的合并策略
if (process.env.NODE_ENV !== 'production') {
  // 非生产环境下在 strats 策略对象上添加两个策略(两个属性)分别是 el 和 propsData，且这两个属性的值是一个函数
  strats.el = strats.propsData = function (parent, child, vm, key) {
    /*
      一、策略函数中的 vm 来自于 mergeOptions 函数的第三个参数。
          所以当调用 mergeOptions 函数且不传递第三个参数的时候，那么在策略函数中就拿不到 vm 参数。
          所以我们可以猜测到一件事，那就是 mergeOptions 函数除了在 _init 方法中被调用之外，还在其他地方被调用，且没有传递第三个参数。

      二、那么mergeOptions到底是在哪里被调用的呢？在 Vue.extend 方法中被调用的， core/global-api/extend.js 文件找到 Vue.extend 方法，其中有这么一段代码：
          Sub.options = mergeOptions(
            Super.options,
            extendOptions
          )
          可以发现，此时调用 mergeOptions 函数就没有传递第三个参数，
          也就是说通过 Vue.extend 创建子类的时候 mergeOptions 会被调用，此时策略函数就拿不到第三个参数。

      三、通过Vue.extend创建子类演示
          //其中Super.options为Vue.options，extendOptions为Vue.extend参数
          var Child = Vue.extend({
            template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
            data: function () {
              return {
                firstName: 'Walter',
                lastName: 'White',
                alias: 'Heisenberg'
              }
            }
          })
    */
    // 当没有 vm 参数时，说明处理的是通过Vue.extend创建的子组件的选项！！！！！
    // 说明在Vue.extend的options中不能包含el和propsData两个key值！！！！！
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    // 只要子选项不是 undefined 那么就是用子选项，否则使用父选项。
    return defaultStrat(parent, child)
  }
}
/**
 * Default strategy.
 */
// 当一个选项不需要特殊处理的时候就使用默认的合并策略，
// 它的逻辑很简单：只要子选项不是 undefined 那么就是用子选项，否则使用父选项。
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}



// strats上data的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  /*
    一、策略函数中的 vm 来自于 mergeOptions 函数的第三个参数。
        所以当调用 mergeOptions 函数且不传递第三个参数的时候，那么在策略函数中就拿不到 vm 参数。
        所以我们可以猜测到一件事，那就是 mergeOptions 函数除了在 _init 方法中被调用之外，还在其他地方被调用，且没有传递第三个参数。

    二、那么mergeOptions到底是在哪里被调用的呢？在 Vue.extend 方法中被调用的， core/global-api/extend.js 文件找到 Vue.extend 方法，其中有这么一段代码：
        Sub.options = mergeOptions(
          Super.options,
          extendOptions
        )
        可以发现，此时调用 mergeOptions 函数就没有传递第三个参数，
        也就是说通过 Vue.extend 创建子类的时候 mergeOptions 会被调用，此时策略函数就拿不到第三个参数。

    三、通过Vue.extend创建子类演示
        //其中Super.options为Vue.options，extendOptions为Vue.extend参数
        var Child = Vue.extend({
          template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
          data: function () {
            return {
              firstName: 'Walter',
              lastName: 'White',
              alias: 'Heisenberg'
            }
          }
        })
  */
  // 当没有 vm 参数时，说明处理的是通过Vue.extend创建的子组件的选项！！！！！
  if (!vm) {
    // 如果 childVal 不是函数，除了给一段警告之外，会直接返回 parentVal
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      return parentVal
    }
    // 如果 childVal 是函数，说明满足了子组件的 data 选项是一个函数的要求，那么就直接返回 mergeDataOrFn 函数的执行结果
    return mergeDataOrFn.call(this, parentVal, childVal)
  }
  // 如果拿到了 vm 参数，那么说明处理的选项不是通过Vue.extend创建的子组件的选项！！！！！
  // 而是正常使用 new 操作符创建实例时的选项，这个时候则直接返回 mergeDataOrFn 的函数执行结果，但是会传入vm实例
  return mergeDataOrFn(parentVal, childVal, vm)
}
// strats上provide的合并策略：与data 选项的合并策略相同，都是用 mergeDataOrFn 函数
strats.provide = mergeDataOrFn
/**
 * Data
 */
// strats上data、provide的合并策略 ： mergeDataOrFn 函数永远返回一个函数
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 当没有 vm 参数时，说明处理的是通过Vue.extend创建的子组件的选项！！！！！
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    /*
      一、如果没有 childVal，也就是说子组件的选项中没有 data 选项，那么直接返回 parentVal，比如下面的代码：
          Vue.extend({})
      二、我们使用 Vue.extend 函数创建子类的时候传递的子组件选项是一个空对象，即没有 data 选项，那么此时 parentVal 实际上就是 Vue.options，
          由于 Vue.options 上也没有 data 这个属性，所以压根就不会执行 strats.data 策略函数，也就更不会执行 mergeDataOrFn 函数
      三、既然都没有执行，那么这里的 return parentVal 是不是多余的？当然不多余，因为 parentVal 存在有值的情况。
          那么什么时候才会出现 childVal 不存在但是 parentVal 存在的情况呢？看下面的代码：
          const Parent = Vue.extend({
            data: function () {
              return {
                test: 1
              }
            }
          })

          const Child = Parent.extend({})
          注意：Parent.options 是哪里来的呢？实际就是 Vue.extend 函数内使用 mergeOptions 生成的，
                所以此时 parentVal 必定是个函数，因为 strats.data 策略函数在处理 data 选项后返回的始终是一个函数。
     */
    // 返回父类的 data 选项
    if (!childVal) {
      return parentVal
    }
    // 返回子类的 data 选项
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    /*
      mergeDataOrFn 函数在处理子组件选项时返回的总是一个函数，
      这也就间接导致 strats.data 策略函数在处理子组件选项时返回的也总是一个函数。
    */
    // 返回 mergedDataFn 函数
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this) : parentVal
      )
    }
  } 
  // 如果拿到了 vm 参数，那么说明处理的选项不是通过Vue.extend创建的子组件的选项！！！！！
  // 而是正常使用 new 操作符创建实例时的选项
  else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      // 子类data选项
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      // 父类data选项
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : parentVal
      // 子类data选项存在，合并父子类data选项
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      }
      // 子类data选项不存在，返回父类data选项
      else {
        return defaultData
      }
    }
  }
}
/**
 * Helper that recursively merges two data objects together.
 */
// strats上data、provide的终极合并策略（to是child，from是parent）
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  // 遍历父类data，目的是父类存在则取子类 (watch选项是遍历子类，目的是父类存在则合并)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    // 如果父类 data 中的 key 不在子类 data 中，则使用 set 函数为子类 data 对象设置 key 及相应的值（这里的set就是Vue.$set）
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } 
    // 如果父子类 data 中的 key都为对象的话，则进行深度递归合并
    else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  // 将父类 data 的属性混合到子类 data 中，最后返回的是混入父类选项后的子类 data
  return to
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
  /*  
    一、如果有 parentVal 那么其一定是数组，如果没有 parentVal 那么 strats[hooks] 函数根本不会执行
    二、Array.isArray(childVal)说明了生命周期钩子是可以写成数组的
        1、父组件：
            const Parent = Vue.extend({
              created: function () {
                console.log('parentVal')
              }
            })
            子组件：
            const Child = new Parent({
              created: function () {
                console.log('childVal')
              }
            })

        2、parentVal 已经不是 Vue.options.created 了，而是 Parent.options.created，那么 Parent.options.created 是什么呢？
           它其实是通过 Vue.extend 函数内部的 mergeOptions 处理过的，所以它应该是这样的：
            Parent.options.created = [
              created: function () {
                console.log('parentVal')
              }
            ]

            所以最终合并为：
            [
              created: function () {
                console.log('parentVal')
              },
              created: function () {
                console.log('childVal')
              }
            ]
      三、生命周期函数可以写成数组的形式
        new Vue({
          created: [
            function () {
              console.log('first')
            },
            function () {
              console.log('second')
            },
            function () {
              console.log('third')
            }
          ]
        })
  */
  return childVal // 是否有 childVal，即判断组件的选项中是否有对应名字的生命周期钩子函数
    ? parentVal // 如果有 childVal 则判断是否有 parentVal
      ? parentVal.concat(childVal) // 如果有 parentVal 则使用 concat 方法将二者合并为一个数组
      : Array.isArray(childVal) // 如果没有 parentVal 则判断 childVal 是不是一个数组
        ? childVal // 如果 childVal 是一个数组则直接返回
        : [childVal] // 否则将其作为数组的元素，然后返回数组
    : parentVal // 如果没有 childVal 则直接返回 parentVal
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
  /*
    一、
        子组件：
        components: {
          ChildComponent: ChildComponent
        }
        父组件：
        Vue.options = {
          components: {
            KeepAlive,
            Transition,
            TransitionGroup
          },
          directives: Object.create(null),
          directives:{
            model,
            show
          },
          filters: Object.create(null),
          _base: Vue
        }
   二、
        合并后：
        res = {
          ChildComponent
          // 原型
          __proto__: {
            KeepAlive,
            Transition,
            TransitionGroup
          }
        }
    所以：
        所以这就是为什么我们不用显式地注册组件就能够使用一些内置组件的原因，同时这也是内置组件的实现方式，
        通过 Vue.extend 创建出来的子类也是一样的道理，一层一层地通过原型进行组件的搜索。
  */
  // 可以在res原型上找到内置组件 KeepAlive,Transition,TransitionGroup
  const res = Object.create(parentVal || null)
  // 如果child options上这些属性存在，合并parent options
  if (childVal) {
    // assertObjectType是用来检测 childVal 是不是一个纯对象的，如果不是纯对象会给你一个警告
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } 
  // 如果child options上这些属性不存在，返回父类options
  else {
    return res
  }
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
  /* 
    一、watch为数组
        // 创建子类
        const Sub = Vue.extend({
          // 检测 test 的变化
          watch: {
            test: function () {
              console.log('extend: test change')
            }
          }
        })

        // 使用子类创建实例
        const v = new Sub({
          el: '#app',
          data: {
            test: 1
          },
          // 检测 test 的变化
          watch: {
            test: function () {
              console.log('instance: test change')
            }
          }
        })

        // 修改 test 的值
        v.test = 2
        // 合并的watch
        watch: {
          test: [
            function () {
              console.log('extend: test change')
            },
            function () {
              console.log('instance: test change')
            }
          ]
        }

    二、watch为函数
      // 直接使用 Vue 创建实例，
      const v = new Vue({
        el: '#app',
        data: {
          test: 1
        },
        // 检测 test 的变化
        watch: {
          test: function () {
            console.log('instance: test change')
          }
        }
      })
      // 这个时候对于实例 v 来说，父选项是 Vue.options，其并没有 watch 选项，
      // 所以逻辑将直接在 strats.watch 函数的这句话中返回：if (!parentVal) return childVal

      // 所以：合并后的watch为一个函数
      {
        test: function () {
          console.log('instance: test change')
        }
      }
  */
  // work around Firefox's Object.prototype.watch...
  // 火狐浏览器在对象原型中有一个watch函数，
  // 当发现组件选项是浏览器原生的 watch 时，那说明用户并没有提供 Vue 的 watch 选项，直接重置为 undefined
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  
  /* istanbul ignore if */
  // 子类没有watch 选项，直接以 parentVal 为原型创建对象并返回(如果有 parentVal 的话)
  if (!childVal) return Object.create(parentVal || null)

  // Vue 的 watch 选项需要是一个纯对象
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }

  // 父类没有 watch 选项，直接使用子类的 watch (此时监听为函数不是数组)
  if (!parentVal) return childVal

  // 父类和子类均存在 watch 选项
  // 定义 ret 常量，其值为一个对象
  const ret = {}
  // 将父类 watch 选项混合到 ret 中
  extend(ret, parentVal)
  // 遍历子类 watch，目的是父类存在则合并 (data选项是遍历父类，目的是父类存在则取子类)
  for (const key in childVal) {
    // 由于遍历的是子类 watch 选项，所以 key 是子类 watch 的 key，父类选项中未必能获取到值，所以 parent 未必有值
    let parent = ret[key]
    // child 是肯定有值的，因为遍历的就是子类 watch 本身
    const child = childVal[key]
    // 这个 if 分支的作用就是如果父类 watch 存在，就将其转为数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      // 最后，如果父类 watch 存在，此时的父类 watch 应该已经被转为数组了，所以直接将子类 watch concat 进去
      ? parent.concat(child)
      // 如果父类 watch 不存在，直接将子类 watch 转为数组返回
      : Array.isArray(child) ? child : [child]
  }
  // 最后返回新的 ret 对象
  return ret
}



/**
 * Other object hashes.
 */
// strats上props、methods、inject、computed的合并策略
/*
  虽然我们在书写 props 或者 inject 选项的时候可能是一个数组，
  但是通过normalizeProps、normalizeInject方法我们知道，Vue 内部都将其规范化为了一个对象
*/
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // 如果存在 childVal，那么在非生产环境下要检查 childVal 的类型
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  // parentVal 不存在的情况下直接返回 childVal
  if (!parentVal) return childVal

  // 如果 parentVal 存在，则创建 ret 对象
  const ret = Object.create(null)
  // parentVal存在，则将 parentVal 混合到 ret 中
  extend(ret, parentVal)
  // childVal存在，则将 childVal 的属性混合到 ret 中，注意：hildVal 将覆盖 parentVal 的同名属性 （与data选项相识，watch是合并）
  if (childVal) extend(ret, childVal)

  // 最后返回 ret 对象。
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
  /*  
    <div id="app" v-test1 v-test2>{{test}}</div>

    var vm = new Vue({
      el: '#app',
      data: {
        test: 1
      },
      
      // 注册两个局部指令
      directives: {
        test1: {
          bind: function () {
            console.log('v-test1')
          }
        },
        test2: function () {
          console.log('v-test2')
        }
      }
    })
  */
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



  /* Vue.component：子类options为{ created () {},mounted () {} }，Parent.options实际就是 Vue.component 函数内使用 mergeOptions 生成的
    const childComponent  = Vue.component('child', {
        mixins: [myMixin],
        extends: myExtend,
        created () {
          console.log('created:main')
        },
        mounted () {
          console.log('mounted:main')
        }
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
    const myExtend = {
        mounted: function () {
          this.goodbye()
        },
        methods: {
          goodbye: function () {
            console.log('goodbye from mixin')
          }
       }
    }
    mergeOptions 函数在处理 mixins 选项的时候递归调用了 mergeOptions 函数将 mixins 合并到了 parent 中，并将合并后生成的新对象作为新的 parent
    对于 extends 选项，与 mixins 相同，甚至由于 extends 选项只能是一个对象，而不能是数组，反而要比 mixins 的实现更为简单，连遍历都不需要。
  */
  /* Vue.extend：子类options为空对象，Parent.options实际就是 Vue.extend 函数内使用 mergeOptions 生成的
    // 创建构造器
    var Parent = Vue.extend({
      template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
      data: function () {
        return {
          firstName: 'Walter',
          lastName: 'White',
          alias: 'Heisenberg'
        }
      }
    })
    // 创建 Parent 实例，并挂载到一个元素上。
    var child = new parent()
    child.$mount('#mount-point')
  */
  /* Vue.mixin：子类options为 { myOption: 'hello!' }，Parent.options实际就是 Vue.mixin 函数内使用 mergeOptions 生成的
    //  为自定义的选项 'myOption' 注入一个处理器。
        Vue.mixin({
          created: function () {
            var myOption = this.$options.myOption
            if (myOption) {
              console.log(myOption) // => "hello!"
            }
          }
        })
        new Vue({
          myOption: 'hello!'
        })
    //  相当于：
        new Vue({
          myOption: 'hello!',
          mixins: {
            created: function () {
              var myOption = this.$options.myOption
              if (myOption) {
                console.log(myOption) // => "hello!"
              }
            }
          }
        })
  */
  // 当传入的options里有extends属性时，再次调用mergeOptions方法合并extends里的内容到实例的构造函数options上（即parent options）
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  // 当传入的options里有mixin属性时，再次调用mergeOptions方法合并mixins里的内容到实例的构造函数options上（即parent options）
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
    // 第一句代码定义了一个常量 strat，其为一个函数，它的值是通过指定的 key 访问 strats 对象得到的，
    // 而当访问的属性不存在时，则使用 defaultStrat 作为默认选项
    const strat = strats[key] || defaultStrat
    // strats[key]是定义的很多函数，会执行的
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
