/**
 * [applyMixin: installl vuex]
 * @param  {[Vue ]} Vue [Vue实例对象]
 * @return {[type]}     [description]
 */
export default function (Vue) {
  const version = Number(Vue.version.split('.')[0])

  /*如果是2.x.x以上版本，可以使用 hook 的形式进行注入*/
  if (version >= 2) {
    /*Vue.mixin 实现：将参数 { beforeCreate: vuexInit } 与 this.options 合并*/
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    /*缓存 Vue.prototype._init 方法*/
    const _init = Vue.prototype._init
    /*重写 Vue.prototype._init 方法*/
    Vue.prototype._init = function (options = {}) {
      /*options.init 属性混入 vuexInit 函数*/
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      /*执行初始缓存的 Vue.prototype._init 方法*/
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   */
  /*将所有组件注入 $store 属性，指向 vuex 实例对象*/
  function vuexInit () {
    const options = this.$options
    // store injection
    /*根节点：new Vue 时传入 store 实例*/
    if (options.store) {
      /*1、将初始化Vue根组件时传入的 store 实例设置到 this 对象的 $store 属性上*/
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } 
    /*非根节点：找其父节点的 $store 属性*/
    else if (options.parent && options.parent.$store) {
      /*2、子组件从其父组件引用$store属性，层层嵌套进行设置。在任意组件中执行 this.$store 都能找到装载的那个store对象*/
      this.$store = options.parent.$store
    }
  }
}
