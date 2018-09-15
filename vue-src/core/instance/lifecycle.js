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

/* 
  这个变量将总是保存着当前正在渲染的实例的引用
  这个变量将总是保存着当前正在渲染的实例的引用，
  所以它就是当前实例 components 下注册的子组件的父实例，所以 Vue 实际上就是这样做到自动侦测父级的。
*/
export let activeInstance: any = null
/*
  isUpdatingChildComponent 初始值为 false，只有当 updateChildComponent 函数开始执行的时候会被更新为 true，
  当 updateChildComponent 执行结束时又将 isUpdatingChildComponent 的值还原为 false，
  这是因为 updateChildComponent 函数需要更新实例对象的 $attrs 和 $listeners 属性，所以此时是不需要提示 $attrs 和 $listeners 是只读属性的。
*/
export let isUpdatingChildComponent: boolean = false

// initLifeCycle方法用来初始化一些生命周期相关的属性，以及为parent,child等属性赋值
export function initLifecycle (vm: Component) {
  // 定义 options，它是 vm.$options 的引用，后面的代码使用的都是 options 常量
  const options = vm.$options



  /* 一、options.parent来自哪里？
    // 子组件本身并没有指定 parent 选项
    var ChildComponent = {
      created () {
        // 但是在子组件中访问父实例，能够找到正确的父实例引用
        console.log(this.$options.parent)
      }
    }

    var vm = new Vue({
        el: '#app',
        components: {
          // 注册组件
          ChildComponent
        },
        data: {
            test: 1
        }
    })

    1、Vue 给我们提供了 parent 选项，使得我们可以手动指定一个组件的父实例，
    2、但在上面的例子中，我们并没有手动指定 parent 选项，但是子组件依然能够正确地找到它的父实例，
    3、这说明 Vue 在寻找父实例的时候是自动检测的。那它是怎么做的呢？
  */
  /* 二、options.abstract哪里设置？抽象的组件有什么特点呢？
    // Vue 内部有一些选项是没有暴露给我们的，就比如这里的 abstract，
    // 通过设置这个选项为 true，可以指定该组件是抽象的，那么通过该组件创建的实例也都是抽象的
    AbsComponents = {
      abstract: true,
      created () {
        console.log('我是一个抽象的组件')
      }
    }

    1、一个最显著的特点就是它们一般不渲染真实DOM，
       举个例子大家就明白了，Vue 内置了一些全局组件比如 keep-alive 或者 transition，
       我们知道这两个组件它是不会渲染DOM至页面的，但他们依然给我提供了很有用的功能。
    2、除了不渲染真实DOM，抽象组件还有一个特点，就是它们不会出现在父子关系的路径上。
       这么设计也是合理的，这是由它们的性质所决定的。
  */
  // locate first non-abstract parent (查找第一个非抽象的父组件)
  // 定义 parent，它引用当前实例的父实例
  let parent = options.parent // options.parent 值的来历，且知道了它的值指向父实例
  // 如果当前实例有父组件，且当前实例不是抽象的，是一个普通的组件实例
  if (parent && !options.abstract) {
    /*
      抽象的组件是不能够也不应该作为父级的，
      所以 while 循环的目的就是沿着父实例链逐层向上寻找到第一个不抽象的实例作为 parent（父级）。
      并且在找到父级之后将当前实例添加到父实例的 $children 属性中，这样最终的目的就达成了。
    */
    // 使用 while 循环查找第一个非抽象的父组件
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    // 经过上面的 while 循环后，parent 应该是一个非抽象的组件，将它作为当前实例的父级，
    // 所以将当前实例 vm 添加到父级的 $children 属性里！！！！！！
    parent.$children.push(vm)
  }



  // 设置当前实例的 $parent 属性，指向父级！！！！！！
  vm.$parent = parent
  // 设置 $root 属性，有父级就是用父级的 $root，否则 $root 指向自身
  vm.$root = parent ? parent.$root : vm



  //  当前实例的直接子组件。
  //  需要注意 $children 并不保证顺序，也不是响应式的。
  vm.$children = []
  // 一个对象，持有已注册过 ref 的所有子组件。
  vm.$refs = {}



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

/**
 * [lifecycleMixin  在 Vue.prototype 上添加了四个方法：_update、$forceUpdate、$destroy]
 * @param  {[type]} Vue: Class<Component> [传入Vue构造函数]
 * @return {[type]}                       [description]
 */
export function lifecycleMixin (Vue: Class<Component>) {
  /** 
   * 将虚拟DOM初始渲染到页面、或者更新视图函数
   */
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 假如已经挂载，调用beforeUpdate钩子
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }
    // 以下变量是试图改变时定义的变量
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode

    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 如果还没有 prevVnode 说明是首次渲染
    // 直接创建真实DOM
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */, // vm.$el为真实DOM、vnode为虚拟DOM
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } 
    // 如果已经有了 prevVnode 说明不是首次渲染
    // 那么就采用 patch 算法进行必要的DOM操作, 这就是Vue更新DOM的逻辑。
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
  /*
    在组件实例对象上添加 $el 属性，其值为挂载元素 el。我们知道 $el 的值是组件模板根元素的引用，如下代码：

      <div id="foo"></div>

      <script>
      const new Vue({
        el: '#foo',
        template: '<div id="bar"></div>'
      })
      </script>
    上面代码中，挂载元素是一个 id 为 foo 的 div 元素，而组件模板是一个 id 为 bar 的 div 元素。
    那么 vm.$el 的值应该是哪一个 div 元素的引用？答案是：vm.$el 是 id 为 bar 的 div 的引用。
    这是因为 vm.$el 始终是组件模板的根元素。由于我们传递了 template 选项指定了模板，那么 vm.$el 自然就是 id 为 bar 的 div 的引用。
  */
  vm.$el = el

  // render 不存在的情况
  if (!vm.$options.render) {
    // options中没有render，也没有编译template编译成的render
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      /*
        1、options中存在template的DOM节点，但是没有编译出render
        2、options中存在el，但是没有编译出render
        结论：不是编译版本的vue
      */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') || vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      }
      /*
        1、options中template是字符串：template:"#template"，但是没有编译出render
        2、options中没有el，但是没有编译出render
        等等意外情况
        结论：不是编译版本的vuetemplate or render function not defined.
      */
      else {
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
   // 开发环境：添加性能调试
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      // vm._render 函数的作用是调用 vm.$options.render 函数并返回生成的虚拟节点(vnode)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      // vm._update 函数的作用是把 vm._render 函数生成的虚拟节点渲染成真正的 DOM
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      // vm._render 函数的作用是调用 vm.$options.render 函数并返回生成的虚拟节点(vnode)
      // vm._update 函数的作用是把 vm._render 函数生成的虚拟节点渲染成真正的 DOM
      vm._update(vm._render(), hydrating)
    }
  }

  /*
    Watcher 观察者实例将对 updateComponent 函数求值， updateComponent 函数的执行会间接触发渲染函数(vm.$options.render)的执行，
    而渲染函数的执行则会触发数据属性的 get 拦截器函数，从而将依赖(观察者)收集，
    当数据变化时将重新执行 updateComponent 函数，这就完成了重新渲染。
    同时我们把上面代码中实例化的观察者对象称为 渲染函数的观察者。
  */
  // Watcher函数第一个参数是 vm, 第二个参数表达式或者函数, 第三个参数是回调函数，第四个参数是可选配置项
  // Watcher 内部应该对第二个参数求值，也就是运行这个函数：updateComponent() => vm._update(vm._render(), hydrating)；vm._render() 函数被第一个执行( src/core/instance/render.js )
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
      // 返回给定名字的 prop 的值[有各种异常情况的处理]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    /*vm.$options.propsData 的更新是在调用 validateProp 之后进行的*/
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
  // 在 Vue选项的合并中，生命周期钩子选项最终会被合并处理成一个数组，所以得到的 handlers 就是对应生命周期钩子的数组
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
    一、其中 vm._hasHookEvent 是在 initEvents 函数中定义的，
        它的作用是判断是否存在生命周期钩子的事件侦听器，初始化值为 false 代表没有，
        当组件检测到存在生命周期钩子的事件侦听器时，会将 vm._hasHookEvent 设置为 true。
        那么问题来了，什么叫做生命周期钩子的事件侦听器呢？

      1、
      <child
        @hook:beforeCreate="handleChildBeforeCreate"
        @hook:created="handleChildCreated"
        @hook:mounted="handleChildMounted"
        @hook:生命周期钩子
       />

      2、
      // 而像下面这种形式，它也存在钩子函数，但是它的_hasHookEvent就是false。
      const childComponent = Vue.component('child', {
        ...
        created () {
          console.log('child created')
        }
      })

    二、如上代码可以使用 hook: 加 生命周期钩子名称 的方式来监听组件相应的生命周期事件。
        这是 Vue 官方文档上没有体现的，但你确实可以这么用，不过除非你对 Vue 非常了解，否则不建议使用。

    三、疑问：
        vm._hasHookEvent 是在什么时候被设置为 true 的呢？
        或者换句话说，Vue 是如何检测是否存在生命周期事件侦听器的呢？
  */
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
