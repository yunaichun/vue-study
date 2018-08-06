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
    // def(data, '__ob__', new Observer())
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
    // 如果通过push、unshift、splice新增或替换新的元素进来，对新添加进数组的数据进行检测
    if (inserted) ob.observeArray(inserted)
      
    // notify change
    // data.a.push()，是执行data.a的原型arrayMethods上的push方法，而arrayMethods上的push方法是调用Array.prototype上的push方法
    ob.dep.notify()
    return result
  })
})

/**
  * 注意事项：
  由于 JavaScript 的限制，Vue 不能检测以下变动的数组：
  当你利用索引直接设置一个项时，例如：vm.items[indexOfItem] = newValue
  当你修改数组的长度时，例如：vm.items.length = newLength

  举个例子：
  var vm = new Vue({
    data: {
      items: ['a', 'b', 'c']
    }
  })
  vm.items[1] = 'x' // 不是响应性的
  vm.items.length = 2 // 不是响应性的

  为了解决第一类问题，以下两种方式都可以实现和 vm.items[indexOfItem] = newValue 相同的效果，同时也将触发状态更新：
  // 法一: Vue.set
  Vue.set(vm.items, indexOfItem, newValue)
  // 你也可以使用 vm.$set 实例方法，该方法是全局方法 Vue.set 的一个别名：
  vm.$set(vm.items, indexOfItem, newValue)
  // 法二: Array.prototype.splice
  vm.items.splice(indexOfItem, 1, newValue)
  

  为了解决第二类问题，你可以使用 splice：
  vm.items.splice(newLength)
 */