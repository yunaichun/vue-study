/* @flow */

import { warn } from '../util/index'
import { hasSymbol } from 'core/util/env'
import { defineReactive, observerState } from '../observer/index'

// 例子: https://segmentfault.com/a/1190000014095107
// 解析: https://www.jianshu.com/p/d74210eedf68
/**
 provide 选项应该是一个对象或返回一个对象的函数。该对象包含可注入其子孙的属性。
 在该对象中你可以使用 ES2015 Symbols 作为 key，
 但是只在原生支持 Symbol 和 Reflect.ownKeys 的环境下可工作。
 */
export function initProvide (vm: Component) {
  // provide 是向下传递数据的选项。这里先拿到 provide 选项中的内容
  const provide = vm.$options.provide
  // 如果有 provide 选项，将 provide 选项传递给 vm._provided 变为 Vue 实例全局数据
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

// 例子: https://segmentfault.com/a/1190000014095107
// 解析: https://www.jianshu.com/p/d74210eedf68
/**
 inject 选项应该是一个字符串数组或一个对象，
 该对象的 key 代表了本地绑定的名称，
 value 为其 key (字符串或 Symbol) 以在可用的注入中搜索
 */
export function initInjections (vm: Component) {
  // 首先通过 resolveInject 方法获取 inject 选项搜索结果
  const result = resolveInject(vm.$options.inject, vm)
  // 如果有搜索结果，遍历搜索结果并为其中的数据添加 setter 和 getter
  if (result) {
    observerState.shouldConvert = false
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    observerState.shouldConvert = true
  }
}

// 首先通过 resolveInject 方法获取 inject 选项搜索结果
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    // inject 是 :any 类型因为流没有智能到能够指出缓存
    const result = Object.create(null)
    // 获取 inject 选项的 key 数组
    const keys = hasSymbol
        ? Reflect.ownKeys(inject).filter(key => {
          /* istanbul ignore next */
          return Object.getOwnPropertyDescriptor(inject, key).enumerable
        })
        : Object.keys(inject)

    // 遍历keys
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // 获取from值: 即来自provide中的key值
      const provideKey = inject[key].from
      // vue 实例
      let source = vm
      // 从当前组件往上遍历
      while (source) {
        // 存在provide并且inject中的from在Provide中存在
        if (source._provided && provideKey in source._provided) {
          // 获取此key值对应的值：值在provide中
          result[key] = source._provided[provideKey]
          break
        }
        // 反之在父组件中寻找
        source = source.$parent
      }
      if (!source) {
        // 当前inject存在default
        if ('default' in inject[key]) {
          // default对应的值
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm) // default 默认值为一个工厂方法
            : provideDefault // default 默认值为基本类型
        }
        // 开发环境，当前key的inject中不存在default属性，报错
        else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
