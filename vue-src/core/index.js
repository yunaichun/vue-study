/*
1、Vue.prototype 下的属性和方法的挂载主要是在 src/core/instance 目录中的代码处理的

2、Vue 下的静态属性和方法的挂载主要是在 src/core/global-api 目录下的代码处理的

3、web-runtime.js 主要是添加web平台特有的配置、组件和指令，
   web-runtime-with-compiler.js 给Vue的 $mount 方法添加 compiler 编译器，支持 template，将模板 template 编译为render函数。
*/
// 从 Vue 的出生文件导入 Vue
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

// 在 Vue.prototype 上添加 $isServer 属性，该属性代理了来自 core/util/env.js 文件的 isServerRendering 方法
Object.defineProperty(Vue.prototype, '$isServer', {
  // 只读属性
  get: isServerRendering
})

// 在 Vue.prototype 上添加 $ssrContext 属性
Object.defineProperty(Vue.prototype, '$ssrContext', {
  // 只读属性
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// Vue.version 存储了当前 Vue 的版本号
// 打开 scripts/config.js 文件，找到 genConfig 方法，其中有这么一句话：__VERSION__: version。
// 这句话被写在了 rollup 的 replace 插件中，也就是说，__VERSION__ 最终将被 version 的值替换，而 version 的值就是 Vue 的版本号
Vue.version = '__VERSION__'

// 导出 Vue
export default Vue
