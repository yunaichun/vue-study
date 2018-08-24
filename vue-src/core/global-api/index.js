/*
1、Vue.prototype 下的属性和方法的挂载主要是在 src/core/instance 目录中的代码处理的

2、Vue 下的静态属性和方法的挂载主要是在 src/core/global-api 目录下的代码处理的

3、web-runtime.js 主要是添加web平台特有的配置、组件和指令，
   web-runtime-with-compiler.js 给Vue的 $mount 方法添加 compiler 编译器，支持 template，将模板 template 编译为render函数。
*/

/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn, // 错误打印(msg, vm)
  extend, // 对象浅拷贝(to, from)
  nextTick, // 优先级：setImmediate -> MessageChannel -> Promise.then -> setTimeout
  mergeOptions, // 合并参数(parent, child)
  defineReactive // 变为访问器属相(data, keys[i], data[keys[i]])
} from '../util/index'

/**
 * [initGlobalAPI 在Vue构造函数上挂载静态属性和方法：config、util、set、delete、nextTick、options]
 * @param  {[type]} Vue: GlobalAPI     [Vue构造函数]
 * @return {[type]}                    [只是挂载没有返回]
 */
export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    // 开发环境设置值报错
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 在 Vue 构造函数上添加 config 属性，是一个只读的属性
  // 这个属性的添加方式类似Vue.prototype上的属性 $data 以及 $props
  Object.defineProperty(Vue, 'config', configDef)


  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 官方文档没有这四个API，能不用尽量别用
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }


  // 向响应式对象中添加一个属性，并确保这个新属性同样是响应式的，且触发视图更新
  Vue.set = set
  // 删除对象的属性。如果对象是响应式的，确保删除能触发更新视图
  Vue.delete = del
  // 添加nextTick方法
  Vue.nextTick = nextTick



  /* 在 Vue 构造函数上挂载options属性
    Vue.options = {
        components: {
            KeepAlive
        },
        directives: {},
        filters: {},
        _base: Vue
    }
  */
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })
  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // _base被用来标识基本构造函数（也就是Vue），以便在多场景下添加组件扩展
  Vue.options._base = Vue
  extend(Vue.options.components, builtInComponents)

  // 安装 Vue.js 插件
  initUse(Vue)
  // 在 Vue 上全局注册一个混入，影响注册之后所有创建的每个 Vue 实例
  initMixin(Vue)
  // 在 Vue 上添加了 Vue.cid 静态属性，和 Vue.extend 静态方法（使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。）
  initExtend(Vue)
  // 全局注册组件，指令和过滤器：Vue.component、Vue.directive、Vue.filter
  initAssetRegisters(Vue)
}
