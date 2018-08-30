/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import VNode, { cloneVNodes, createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

// 初始化render
export function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree


  /* 在 Vue 当前实例对象上添加了三个实例属性：
    一、vm.$vnode
    二、vm.$slots
    三、vm.$scopedSlots
  */
  const options = vm.$options
  // 父树中的占位符节点
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
  // 当前节点的编译作用域
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject



  /* 在 Vue 当前实例对象上添加了两个方法：
    一、vm._c: 是被模板template编译成的 render 函数使用 （其定义在core/instance/render-helpers/index.js中）
    二、vm.$createElement: 是用户手写 render 方法使用，我们在平时的开发工作中手写 render 方法的场景比较少
        这俩个方法支持的参数相同，并且内部都调用了 createElement 方法

    1、模板
    <div id="app">
      {{ message }}
    </div>
    2、render等价
    render: function (createElement) {
      return createElement('div', {
         attrs: {
            id: 'app'
          },
      }, this.message)
    }
    3、render等价
    render: function () {
      return this.$createElement('div', {
         attrs: {
            id: 'app'
          },
      }, this.message)
    }
    
  */
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false) 
  // normalization is always applied for the public version, used in
  // user-written render functions.
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)




  /* 在 Vue 当前实例对象上添加了两个实例属性：
    一、vm.$attrs
    二、vm.$listeners
   */
  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data
  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    /*
      isUpdatingChildComponent 初始值为 false，只有当 updateChildComponent 函数开始执行的时候会被更新为 true，
      当 updateChildComponent 执行结束时又将 isUpdatingChildComponent 的值还原为 false，
      这是因为 updateChildComponent 函数需要更新实例对象的 $attrs 和 $listeners 属性，所以此时是不需要提示 $attrs 和 $listeners 是只读属性的。
    */
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

/**
 * [renderMixin  在Vue.prototype上定义一系列方法：如$nextTick 和 _render等]
 * @param  {[type]} Vue: Class<Component> [传入Vue构造函数]
 * @return {[type]}                       [description]
 */
export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  // 在 Vue.prototype 上添加一系列方法
  installRenderHelpers(Vue.prototype)

  // 在 Vue.prototype 上添加$nextTick方法
  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  // $mount(platforms/web/runtime/index.js) -> mountComponent(core/instance/lifecycle.js) -> 
  // updateComponent -> vm._update(vm._render(), hydrating)
  /** 
   * 将实例渲染成一个虚拟 Node：这段代码最关键的是 render 方法的调用
   */
  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    /* 解构出 $options 中的 render 函数：
      1、用户手写render
      2、模板template编译成的 render (web-runtime-with-compiler.js文件通过compileToFunctions方法编译)
    */
    const { render, _parentVnode } = vm.$options

    if (vm._isMounted) {
      // if the parent didn't update, the slot nodes will be the ones from
      // last render. They need to be cloned to ensure "freshness" for this render.
      for (const key in vm.$slots) {
        const slot = vm.$slots[key]
        if (slot._rendered) {
          vm.$slots[key] = cloneVNodes(slot, true /* deep */)
        }
      }
    }

    vm.$scopedSlots = (_parentVnode && _parentVnode.data.scopedSlots) || emptyObject

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
      /**
        vm._c: 是被模板template编译成的 render 函数使用；

        vm.$createElement: 是用户手写 render 方法使用，我们在平时的开发工作中手写 render 方法的场景比较少，
        如下：
           <div id="app">
              {{ message }}
            </div>
            相当于我们编写如下 render 函数：
            render: function (createElement) {
              return createElement('div', {
                 attrs: {
                    id: 'app'
                  },
              }, this.message)
            }

        这俩个方法支持的参数相同，并且内部都调用了 createElement 方法。
       */
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        if (vm.$options.renderError) {
          try {
            vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
          } catch (e) {
            handleError(e, vm, `renderError`)
            vnode = vm._vnode
          }
        } else {
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      vnode = createEmptyVNode()
    }
    // set parent
    vnode.parent = _parentVnode
    return vnode
  }
}
