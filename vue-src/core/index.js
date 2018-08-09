/*
1、Vue.prototype 下的属性和方法的挂载主要是在 src/core/instance 目录中的代码处理的

2、Vue 下的静态属性和方法的挂载主要是在 src/core/global-api 目录下的代码处理的

3、web-runtime.js 主要是添加web平台特有的配置、组件和指令，
   web-runtime-with-compiler.js 给Vue的 $mount 方法添加 compiler 编译器，支持 template，将模板 template 编译为render函数。
*/
import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'

/* 在 Vue 构造函数上挂载静态属性和方法 (src/core/global-api/index.js)
    Vue.options = {
        components: {
            KeepAlive
        },
        directives: {},
        filters: {},
        _base: Vue
    }
*/
initGlobalAPI(Vue)

Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

Vue.version = '__VERSION__'

export default Vue
