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
  // 在 Vue 上添加了 Vue.cid 静态属性
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  /**
   * [extend 在 Vue 上添加Vue.extend 静态方法]
   * @param  {[type]} extendOptions: Object        [扩展的配置项]
   * @return {[type]}                              [返回Sub子类]
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    // Super父类：为当前Vue构造函数
    const Super = this
    const SuperId = Super.cid
    // 初始状态：cachedCtors = extendOptions._Ctor = {}
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    /*
      var Child1 = Vue.extend({
        template: '<p>{{firstName}} {{lastName}} aka {{alias}}</p>',
        data: function () {
          return {
            firstName: 'Walter',
            lastName: 'White',
            alias: 'Heisenberg'
          }
        }
      })
      var Child2 = Vue.extend({
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
    // 如果extendOptions._Ctor.SuperId存在，说明之前已经用相同的配置Vue.extend一次
    // 之前做过缓存，直接去缓存值即可，不用再一步步初始化了
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }



    // Vue.extend选项中存在name取其值，否则取父类的name
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production') {
      // 开发环境对组件名称进行校验
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

    // 定义Vue.extend创建的子类
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 子类的原型为父类的原型
    Sub.prototype = Object.create(Super.prototype)
    // 增强对象
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    /*
      此时调用 mergeOptions 函数就没有传递第三个参数，
      也就是说通过 Vue.extend 创建子类的时候 mergeOptions 会被调用，此时策略函数就拿不到第三个参数
    */
    /*其中Super.options为Vue.options，extendOptions为Vue.extend参数
        // 创建子类
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
    // Sub.options：Vue.options与Vue.extend的options通过mergeOptions的合并项
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    // Sub构造函数可以通过super属性指向Super构造函数
    Sub['super'] = Super


    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    // props存在的话，将option中的_props代理到vm上
    if (Sub.options.props) {
      initProps(Sub)
    }
    // computed存在的话，给计算属性设置defineProperty并绑定在vm上
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
    /*
      Vue.options = {
          components: {
              KeepAlive,
              Transition,
              TransitionGroup
          },
          directives: {
              model,
              show
          },
          filters: {},
          _base: Vue
      }
    */
    // 继承component、directive、filter
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    // name存在的话，通过components.name可以获取到当前组件
    if (name) {
      Sub.options.components[name] = Sub
    }


    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    /*其中Sub.options为Vue.options，Sub.extendOptions为Vue.extend参数，Sub.sealedOptions
        Vue.mixin({ 
          data: function () {
            return {
              firstName: 'Walter',
              lastName: 'White',
              alias: 'Heisenberg'
            }
          }
        })
        // 创建子类
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
    // Sub.superOptions：Vue.options
    Sub.superOptions = Super.options
    // Sub.extendOptions：Vue.extend中的options
    Sub.extendOptions = extendOptions
    // Sub.sealedOptions：Vue.options与Vue.extend的options通过mergeOptions的合并项
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 缓存：将通过执行父类(SuperId)，指定配置(extendOptions)产生的子类Sub缓存在cachedCtors变量中，同时也会缓存在extendOptions._Ctor中
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
