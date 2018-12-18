import View from './components/view'
import Link from './components/link'

/*这里导出一个私有的 Vue 引用的目的是: 插件不必将 Vue.js 作为一个依赖打包, 但插件的其它模块有可能要依赖 Vue 实例的一些方法, 其它模块可以从这里获取到 Vue 实例引用.*/
export let _Vue

export function install (Vue) {
  /*确保 install 调用一次*/
  if (install.installed && _Vue === Vue) return
  install.installed = true

  /*把 Vue 赋值给全局变量*/
  _Vue = Vue
  const isDef = v => v !== undefined
  const registerInstance = (vm, callVal) => {
    /*至少存在一个 VueComponent 时, _parentVnode 属性才存在*/
    let i = vm.$options._parentVnode
    /*registerRouteInstance 在 src/components/view.js中*/
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  /*给每个组件的钩子函数混入实现，可以发现在 `beforeCreate` 钩子执行时，会初始化路由*/
  Vue.mixin({
    beforeCreate () {
      /*判断组件是否存在 router 对象，该对象只在根组件上有*/
      if (isDef(this.$options.router)) {
        /*通过 this._routerRoot._router 可以获取到 this.$options.router，为 router 的实例*/
        this._routerRoot = this
        this._router = this.$options.router
        /* 调用 router 实例的 init 初始化方法*/
        this._router.init(this)
        /*vue 实例的 _route 属性实现双向绑定触发组件渲染*/
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        /*使 vue 所有组件内部均能通过t his._routerRoot._router 获取到 this.$options.router*/
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      /*注册 VueComponent，进行 observer 处理*/
      registerInstance(this, this)
    },
    destroyed () {
      /*取消 VueComponent 的注册*/
      registerInstance(this)
    }
  })

  /*定义 $router 和 $route 的 getter，在 vue 组件中可以通过 this.$router 和 this.$route 访问 this.$options.router，为 router 的实例*/
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  /*注册 router-view、router-link 组件*/
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  /*注册 router 生命周期函数：beforeRouteEnter、beforeRouteLeave、beforeRouteUpdate*/
  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
