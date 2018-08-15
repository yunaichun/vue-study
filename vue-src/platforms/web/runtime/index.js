/*
1、Vue.prototype 下的属性和方法的挂载主要是在 src/core/instance 目录中的代码处理的

2、Vue 下的静态属性和方法的挂载主要是在 src/core/global-api 目录下的代码处理的

3、web-runtime.js 主要是添加web平台特有的配置、组件和指令，
   web-runtime-with-compiler.js 给Vue的 $mount 方法添加 compiler 编译器，支持 template，将模板 template 编译为render函数。
*/

/* @flow */

import Vue from 'core/index'
import config from 'core/config'
import { extend, noop } from 'shared/util'
import { mountComponent } from 'core/instance/lifecycle'
import { devtools, inBrowser, isChrome } from 'core/util/index'

import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'

import { patch } from './patch'
import platformDirectives from './directives/index'
import platformComponents from './components/index'

// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement

// install platform runtime directives & components
/* 安装平台特定的 指令 和 组件 (/src/core/global-api/index.js)
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
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)

// install platform patch function
// 将虚拟DOM初始渲染到页面、或者更新视图函数
Vue.prototype.__patch__ = inBrowser ? patch : noop

// public mount method
// 通过 el 获取相应的DOM元素
// 然后调用 lifecycle.js 文件中的 _mount 方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 首先根据是否是浏览器环境决定要不要 query(el) 获取元素，
  // 然后将 el 作为参数传递给 this._mount()。
  el = el && inBrowser ? query(el) : undefined
  // 调用lifecycle生命周期中的挂载组件mountComponent函数 (core/instance/lifecycle.js)
  return mountComponent(this, el, hydrating)
}

// devtools global hook
/* istanbul ignore next */
Vue.nextTick(() => {
  if (config.devtools) {
    if (devtools) {
      devtools.emit('init', Vue)
    } else if (process.env.NODE_ENV !== 'production' && isChrome) {
      console[console.info ? 'info' : 'log'](
        'Download the Vue Devtools extension for a better development experience:\n' +
        'https://github.com/vuejs/vue-devtools'
      )
    }
  }
  if (process.env.NODE_ENV !== 'production' &&
    config.productionTip !== false &&
    inBrowser && typeof console !== 'undefined'
  ) {
    console[console.info ? 'info' : 'log'](
      `You are running Vue in development mode.\n` +
      `Make sure to turn on production mode when deploying for production.\n` +
      `See more tips at https://vuejs.org/guide/deployment.html`
    )
  }
}, 0)

export default Vue
