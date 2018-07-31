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
    // this.__ob__ = new Observer()
    // this.__ob__就是一个Observe实例，通过其上的observeArray可以对新加入的数组元素添加访问器属性
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
    // 如果通过push、unshift、splice新增或替换新的元素进来，将新添加进数组的数据变为访问器属性
    if (inserted) ob.observeArray(inserted)
      
    // notify change
    // data.a.push()，是执行data.a的原型arrayMethods上的push方法，而arrayMethods上的push方法是调用Array.prototype上的push方法
    // dep对象通知所有的观察者【此dep与this.dep相同】
    ob.dep.notify()
    return result
  })
})
