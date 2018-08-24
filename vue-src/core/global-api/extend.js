/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { warn, extend, mergeOptions } from '../util/index'
import { defineComputed, proxy } from '../instance/state'

/**
 * [initExtend description]
 * @param  {[type]} Vue: GlobalAPI     [使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。]
 * @return {[type]}                    [返回Vue构造函数]
 */
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  /**
   * [extend 使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。]
   * @param  {[type]} extendOptions: Object        [扩展的配置项]
   * @return {[type]}                              [返回Sub子类]
   */
  Vue.extend = function (extendOptions: Object): Function {
    // Vue.extend参数
    extendOptions = extendOptions || {}
    // 缓存Vue构造函数，Super即为Vue构造函数
    const Super = this
    // 缓存Vue父类的cid
    const SuperId = Super.cid
    // 缓存Vue.extend参数的_Ctor属性
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    // 如果连续extend相同配置，直接返回
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    // 父类组件名称
    const name = extendOptions.name || Super.options.name
    // 开发环境对组件名称进行校验
    if (process.env.NODE_ENV !== 'production') {
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

    // 构造Sub为Vue基类
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // Sub的原型为Vue.prototype
    Sub.prototype = Object.create(Super.prototype)
    // Sub.prototype构造函数指向Sub
    Sub.prototype.constructor = Sub
    // Sub的cid自增
    Sub.cid = cid++
    // Sub的options配置项是当前Vue的options的配置项和传递参数的合并
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // Sub的super指向Super，Super即为Vue构造函数
    Sub['super'] = Super


    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }


    // allow further extension/mixin/plugin usage
    // 允许子类可以扩展
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use


    // create asset registers, so extended classes
    // can have their private assets too.
    // 继承component、directive、filter
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    // 将自身存在components中
    if (name) {
      Sub.options.components[name] = Sub
    }


    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    /*
      var Profile = Vue.extend({
         template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>'
      })
      Vue.mixin({ data: function () {
        return {
          firstName: 'Walter',
          lastName: 'White',
          alias: 'Heisenberg'
        }
      }})
      new Profile().$mount('#example')  // (其中Profile为父类，Vue是子类)
      Vue.mixin改变了"父类"options。
    */
    // Sub.superOptions指向基础构造器的options
    Sub.superOptions = Super.options
    // Sub.extendOptions指向Vue.extend中的参数option
    Sub.extendOptions = extendOptions
    // Sub.sealedOptions指向 Sub.superOptions + Sub.extendOptions合并后的配置options
    // 这个属性就是方便检查"自身"的options有没有变化
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 将Sub缓存起来，存储在cachedCtors中，避免重复继承，直接取缓存就可以了
    cachedCtors[SuperId] = Sub
    // 返回Sub子类
    return Sub
  }
}

/**
 * [initProps 初始化props，将option中的_props代理到vm上]
 * @param  {[type]} Comp [Sub子类]
 * @return {[type]}      [description]
 */
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

/**
 * [initComputed 处理计算属性，给计算属性设置defineProperty并绑定在vm上]
 * @param  {[type]} Comp [Sub子类]
 * @return {[type]}      [description]
 */
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
