import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  /*手写 render 函数*/
  render (_, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    /*创建虚拟DOM*/
    const h = parent.$createElement
    const name = props.name
    /*路由对象*/
    const route = parent.$route
    /*缓存*/
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
   /*向父级往上查找，直到 parent._routerRoot 等于 parent*/
    while (parent && parent._routerRoot !== parent) {
      if (parent.$vnode && parent.$vnode.data.routerView) {
        depth++
      }
      if (parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    /*层级*/
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    /*创建虚拟DOM*/
    if (inactive) {
      return h(cache[name], data, children)
    }

    /*当前路由匹配对象*/
    const matched = route.matched[depth]
    // render empty node if no matched route
    /*没有匹配的路由对象，创建空虚拟DOM*/
    if (!matched) {
      cache[name] = null
      return h()
    }

    /*有匹配的路由对象：去除匹配的路由对象对应的组件 components*/
    const component = cache[name] = matched.components[name]

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    /*注册路由实例*/
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    /*注册 prepatch 钩子：在不同的路由上重用相同的组件实例*/
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // resolve props
    /* 根据 route.matched[depth].props[name] ，设置 data.props 属性*/
    let propsToPass = data.props = resolveProps(route, matched.props && matched.props[name])
    if (propsToPass) {
      // clone to prevent mutation
      propsToPass = data.props = extend({}, propsToPass)
      // pass non-declared props as attrs
      const attrs = data.attrs = data.attrs || {}
      /*遍历 matched.props[name]*/
      for (const key in propsToPass) {
        /*不在 route.matched[depth].components[name].props 中的 key*/
        if (!component.props || !(key in component.props)) {
          /*设置 data.attrs 属性*/
          attrs[key] = propsToPass[key]
          delete propsToPass[key]
        }
      }
    }

    /*创建此路由匹配的组件，传入指定的数据和子组件*/
    return h(component, data, children)
  }
}

/*处理 Props 属性*/
function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined': // undefined
      return
    case 'object': // object
      return config
    case 'function': // function
      return config(route)
    case 'boolean':  // boolean
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}
