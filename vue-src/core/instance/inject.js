/* @flow */

import { warn } from '../util/index'
import { hasSymbol } from 'core/util/env'
import { defineReactive, observerState } from '../observer/index'


/**
  一、provide 选项应该是一个对象或返回一个对象的函数。该对象包含可注入其子孙的属性。
      在该对象中可以使用 ES2015 Symbols 作为 key，
      但是只在原生支持 Symbol 和 Reflect.ownKeys 的环境下可工作。

  二、例子: https://segmentfault.com/a/1190000014095107

  三、解析: https://www.jianshu.com/p/d74210eedf68
 */
export function initProvide (vm: Component) {
  // provide 是向下传递数据的选项。这里先拿到 provide 选项中的内容
  const provide = vm.$options.provide
  // 如果有 provide 选项，将 provide 选项传递给 vm._provided 变为 Vue 实例全局数据
  if (provide) {
    // 本质上就是在组件实例对象上添加了 vm._provided 属性，并保存了用于子代组件的数据。
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}


/**
  一、inject 选项应该是一个字符串数组或一个对象，
      该对象的 key 代表了本地绑定的名称，
      value 为其 key (字符串或 Symbol) 以在可用的注入中搜索

  二、例子: https://segmentfault.com/a/1190000014095107
  
  三、解析: https://www.jianshu.com/p/d74210eedf68
 */
export function initInjections (vm: Component) {
  /* 通过 resolveInject 函数取得了注入的数据，并赋值给 result 常量
    一、子组件中通过 inject 选项注入的数据其实是存放在其父代组件实例的 vm._provided 属性中，
    二、实际上 resolveInject 函数的作用就是根据当前组件的 inject 选项去父代组件中寻找注入的数据，并将最终的数据返回。
  */
  const result = resolveInject(vm.$options.inject, vm)
  
  /*成功取得注入的数据*/
  if (result) {
    /*先关闭了响应式定义的开关，之后又将开关开启*/
    observerState.shouldConvert = false
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        /*在非生产环境下调用 defineReactive 函数时会多传递一个参数，即 customSetter，当你尝试设置注入的数据时会提示你不要这么做。*/
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        /*调用 defineReactive 函数在当前组件实例对象 vm 上定义与注入名称相同的变量，并赋予取得的值*/
        defineReactive(vm, key, result[key])
      }
    })
    /*先关闭了响应式定义的开关，之后又将开关开启。原因是：
      一、这么做将会导致使用 defineReactive 定义属性时不会将该属性的值转换为响应式的。

      二、所以 Vue 文档中提到了：
          提示：provide 和 inject 绑定并不是可响应的。这是刻意为之的。
          然而，如果你传入了一个可监听的对象，那么其对象的属性还是可响应的。

      三、当然啦，如果父代组件提供的数据本身就是响应式的，即使 defineReactive 不转，那么最终这个数据也还是响应式的。
    */
    observerState.shouldConvert = true
  }
}
/**
 * [resolveInject 根据当前组件的 inject 选项去父代组件中寻找注入的数据，并将最终的数据返回]
 * @param  {[type]} inject: any           [inject选项]
 * @param  {[type]} vm:     Component     [Vue实例]
 * @return {[type]}         [返回inject数据]
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    /*常量的值为通过 Object.create(null) 创建的空对象，并且 result 常量的值将来会作为返回值被返回*/
    const result = Object.create(null)
    /*
      接着定义了 keys 常量，它的值是一个数组，即由 inject 选项对象所有键名组成的数组，
      在 Vue 选项的规范化 一节中我们讲到了 inject 选项被规范化后将会是一个对象，并且该对象必然会包含 from 属性。
      一、例如如果你的 inject 选项是一个字符串数组：
            inject: ['data1', 'data2']
          那么被规范化后 vm.$options.inject 选项将变为：
            {
              'data1': { from: 'data1' },
              'data2': { from: 'data2' }
            }

      二、如果你的 inject 选项是一个对象，那么这个对象你可以有好几种写法：
            inject: {
              // 第一种写法
              data1: 'd1',
              // 第二种写法
              data2: {
                someProperty: 'someValue'
              }
            }
          如上这两种最终都将被格式化为：
            inject: {
              'data1': { from: 'd1' },
              'data2': { from: 'data2', someProperty: 'someValue' }
            }
      三、可以看到被规范化后的每个 inject 选项值也都是一个对象，并且都包含 from 属性。
          同时我们注意到 someProperty 属性被保留了，所以你完全可以把 someProperty 属性替换成 default 属性：
            inject: {
              data1: {
                default: 'defaultValue'
              }
            }
          这就是 Vue 文档中提到的可以使用 default 属性为注入的值指定默认值。
    */
    /*
      一、现在我们知道 keys 常量中保存 inject 选项对象的每一个键名，但我们注意到这里有一个对 hasSymbol 的判断，
          其目的是保证 Symbol 类型与 Reflect.ownKeys 可用且为宿主环境原生提供，

      二、如果 hasSymbol 为真，则说明可用，此时会使用 Reflect.ownKeys 获取 inject 对象中所有可枚举的键名，否则使用 Object.keys 作为降级处理。

      三、实际上 Reflect.ownKeys 配合可枚举过滤等价于 Object.keys 与 Object.getOwnPropertySymbols 配合可枚举过滤之和，
          其好处是支持 Symbol 类型作为键名，当然了这一切都建立在宿主环境的支持之上，
          所以 Vue 官网中提到了**inject 选项对象的属性可以使用 ES2015 Symbols 作为 key，
          但是只在原生支持 Symbol 和 Reflect.ownKeys 的环境下可工作**。
    */
    const keys = hasSymbol
        ? Reflect.ownKeys(inject).filter(key => {
          /* istanbul ignore next */
          return Object.getOwnPropertyDescriptor(inject, key).enumerable
        })
        : Object.keys(inject)

    /* 遍历keys */
    for (let i = 0; i < keys.length; i++) {
      /* key 常量就是 keys 数组中的每一个值，即 inject 选项的每一个键值 */
      const key = keys[i]
      /*
        provideKey 常量保存的是每一个 inject 选项内所定义的注入对象的 from 属性的值，
        我们知道 from 属性的值代表着 vm._provided 数据中的每个数据的键名，所以 provideKey 常量将用来查找所注入的数据
      */
      const provideKey = inject[key].from
      /* 最后定义了 source 变量，它的初始值是当前组件实例对象。*/
      let source = vm


      /* 开启一个 while 循环，用来查找注入数据的工作 */
      while (source) {
        /* 当前组件有注入的数据 ：
           “source 变量的初始值为当前组件实例对象，那么如果在当前对象下找到了通过 provide 选项提供的值，那岂不是自身给自身注入数据？”。
           大家不要忘了 inject 选项的初始化是在 provide 选项初始化之前的，也就是说即使该组件通过 provide 选项提供的数据中的确存在 inject 选项注入的数据，也不会有任何影响，
           因为在 inject 选项查找数据时 provide 提供的数据还没有被初始化，所以当一个组件使用 provide 提供数据时，该数据只有子代组件可用。
        */
        if (source._provided && provideKey in source._provided) {
          /* 将注入的数据赋值给 result 对象的同名属性 */
          result[key] = source._provided[provideKey]
          break
        }
        /* 当前组件没有有注入的数据：
           重新赋值 source 变量，使其引用父组件，以此类推就完成了向父代组件查找数据的需求，直到找到数据为止
        */
        source = source.$parent
      }

      /* 如果一直找到了根组件，但依然没有找到数据怎么办？
         一直寻找到根组件也没有找到要的数据，此时需要查看 inject[key] 对象中是否定义了 default 选项，
         如果定义了 default 选项则使用 default 选项提供的数据作为注入的数据，否则在非生产环境下会提示开发者未找到注入的数据。
         另外我们可以看到 default 选项可以是一个函数，此时会通过执行该函数来获取注入的数据。
      */
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault 
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }

    /* 
      该 result 就是最终寻找到的注入的数据。如果 inject 选项不存在则返回 undefined。 
      并且 result 对象的键就是注入数据的名字，result 对象每个键的值就是注入的数据
    */
    return result
  }
}
