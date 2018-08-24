/*
1、Vue.prototype 下的属性和方法的挂载主要是在 src/core/instance 目录中的代码处理的

2、Vue 下的静态属性和方法的挂载主要是在 src/core/global-api 目录下的代码处理的

3、web-runtime.js 主要是添加web平台特有的配置、组件和指令，
   web-runtime-with-compiler.js 给Vue的 $mount 方法添加 compiler 编译器，支持 template，将模板 template 编译为render函数。
*/
// 从五个文件导入五个方法（不包括 warn）
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  // 在调用 _init() 之前，还做了一个安全模式的处理，
  // 告诉开发者必须使用 new 操作符调用 Vue
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 调用来自init.js里Vue.prototype上的方法 (src/core/instance/init.js)
  this._init(options)
}

// 在Vue.prototype上定义_init方法，构造Vue实例的时候会调用这个_init方法来初始化Vue实例
initMixin(Vue)
// 在Vue.prototype上定义三个方法：$set、$delete 以及 $watch；$data和$props数据代理_data和_props
stateMixin(Vue)
// 在 Vue.prototype 上添加了四个方法：$on、$once、$off、$emit
eventsMixin(Vue)
// 在 Vue.prototype 上添加了四个方法：_update、$forceUpdate、$destroy
lifecycleMixin(Vue)
// 在Vue.prototype上定义一系列方法：如$nextTick 和 _render等
renderMixin(Vue)

// 导出 Vue
export default Vue
