/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

// initLifeCycle方法用来初始化一些生命周期相关的属性，以及为parent,child等属性赋值
export function initLifecycle (vm: Component) {
  // 把mergeOptions后的options赋值给options变量
  const options = vm.$options

  // locate first non-abstract parent
  // 定位第一个"非抽象"的父组件
  // 当前vm实例有父实例parent，则赋值给parent变量。
  let parent = options.parent
  // 如果父实例存在，且该实例不是抽象组件
  if (parent && !options.abstract) {
    // 如果父实例parent是抽象组件，则继续找parent上的parent。
    // 直到找到非抽象组件为止。
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 之后把当前vm实例push到定位的第一个非抽象parent的$children属性上 
    parent.$children.push(vm)
  }

  // 指定已创建的实例之父实例，在两者之间建立父子关系。
  // 子实例可以用 this.$parent 访问父实例，子实例被推入父实例的 $children 数组中
  vm.$parent = parent
  // 当前组件树的根 Vue 实例。
  // 如果当前实例没有父实例，此实例将会是其自己。
  vm.$root = parent ? parent.$root : vm

  //  当前实例的直接子组件。
  //  需要注意 $children 并不保证顺序，也不是响应式的。
  vm.$children = []
  // 一个对象，持有已注册过 ref 的所有子组件。
  vm.$refs = {}\

  // 组件实例相应的 watcher 实例对象。
  vm._watcher = null
  // 表示keep-alive中组件状态，如被激活，该值为false, 反之为true。
  vm._inactive = null
  // 也是表示keep-alive中组件状态的属性。
  vm._directInactive = false
  // 当前实例是否完成挂载(对应生命周期图示中的mounted)。
  vm._isMounted = false
  // 前实例是否已经被销毁(对应生命周期图示中的destroyed)。
  vm._isDestroyed = false
  // 当前实例是否正在被销毁,还没有销毁完成(介于生命周期图示中deforeDestroy和destroyed之间)。
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 假如已经挂载，调用beforeUpdate钩子
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 如果还没有 prevVnode 说明是首次渲染，直接创建真实DOM
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } 
    // 如果已经有了 prevVnode 说明不是首次渲染，那么就采用 patch 算法进行必要的DOM操作。
    // 这就是Vue更新DOM的逻辑。只不过我们没有将 virtual DOM 内部的实现。
    else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    vm.$off()
    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

// $mount挂载组件
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // 在Vue实例对象上添加 $el 属性，指向挂载点元素
  vm.$el = el
  // render 不存在的情况去编译template，生成render
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') { // 开发环境
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') || vm.$options.el || el) { // template直接写模板、或存在el选项
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else { // 不存在template且没有el选项
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  // 触发 beforeMount 钩子
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) { // 开发环境
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      // render 函数的作用域是Vue实例本身即：this(或vm)。那么当我们执行 render 函数时，
      // 其中的变量如：a，就相当于：this.a，这是在求值
      // vm_render 方法最终返回一个 vnode 对象，即虚拟DOM，然后作为 vm_update 的第一个参数传递了过去
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      //  // 当 vm._render 执行的时候，所依赖的变量就会被求值，并被收集为依赖。按照Vue中 watcher.js 的逻辑，
      //  当依赖的变量有变化时不仅仅回调函数被执行，实际上还要重新求值，即还要执行一遍：() => { vm._update(vm._render(), hydrating) }
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else { // 生产环境
    updateComponent = () => {
      vm._update(vm._render(), hydrating) // 更新初始渲染的节点
    }
  }

  // Watcher函数第一个参数是 表达式或者函数，第二个参数是回调函数，第三个参数是可选的选项
  // 但是这里Watcher函数第一个参数是vm，这是什么鬼，看看$watch的定义 (core/instance/state.js)
  // 忽略第一个参数 vm，也就说，Watcher 内部应该对第二个参数求值，也就是运行这个函数：() => { vm._update(vm._render(), hydrating) }
  // 所以 vm._render() 函数被第一个执行，该函数在 ( src/core/instance/render.js ) 中
  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 如果是第一次mount则触发 mounted 生命周期钩子
  if (vm.$vnode == null) {
    // 标志位，代表该组件已经挂载
    vm._isMounted = true
    // 触发 mounted 钩子
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = (parentVnode.data && parentVnode.data.attrs) || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }
  // resolve slots + force update if has children
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

// 调用钩子函数、触发生命周期钩子函数
export function callHook (vm: Component, hook: string) {
  // 生命周期函数名称
  const handlers = vm.$options[hook]
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  /*
    当前实例的钩子函数如果是通过父组件的:hook方式来指定的，
    那么它在执行钩子函数的回调方法时就是直接触发vm.$emit来执行。
    （这种方式类似于dom中的addEventListener监听事件和dispatchEvent触发事件）

    如果不是上面这种方法指定的钩子函数，就需要执行callhook源码上半部分的代码逻辑。
    找到vm实例上的钩子函数，然后执行绑定在它上面的回调。
  */
 
  /*
    如果是下列形式绑定的钩子，则_hasHookEvent属性为true。
      <child
        @hook:created="hookFromParent"
      >
    而像下面这种形式，它也存在钩子函数，但是它的_hasHookEvent就是false。
      const childComponent = Vue.component('child', {
        ...
        created () {
          console.log('child created')
        }
      })
   */
  // _hasHookEvent不是表示是否存在钩子，
  // 它表示的是父组件有没有直接绑定钩子函数在当前组件上
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
