/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// 取得原生数组的原型
const arrayProto = Array.prototype
// 创建一个新的数组对象，该对象的原型指向Array.prototype
export const arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */
 // 使用 push 等数组方法的时候，调用的是 fakePrototype 上的push方法，
 // 然后在 fakePrototype 方法中再去调用真正的Array原型上的 push 方法，同时监听变化
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  // 将数组的原生方法缓存起来，后面要调用
  const original = arrayProto[method]
  // 使用 Object.defineProperty 给 arrayMethods 添加属性，属性的key是对应重写的数组函数名，值是此函数
  def(arrayMethods, method, function mutator (...args) {
    // 调用原生的数组方法
    const result = original.apply(this, args)
    // 从上层获取的，待定？
    const ob = this.__ob__

    // 数组新插入的元素需要重新进行observe才能响应式
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args // 添加的元素
        break
      case 'splice':
        inserted = args.slice(2) // 替换的元素
        break
    }
    if (inserted) ob.observeArray(inserted)
      
    // notify change
    // 通知所有watch(注册)观察者进行响应式处理
    ob.dep.notify()
    return result
  })
})
