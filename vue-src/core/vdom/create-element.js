/* @flow */
/*
Vue.js将DOM抽象成一个以JavaScript对象为节点的虚拟DOM树，以VNode节点模拟真实DOM，
可以对这颗抽象树进行创建节点、删除节点以及修改节点等操作，
在这过程中都不需要操作真实DOM，只需要操作JavaScript对象后只对差异修改，相对于整块的innerHTML的粗暴式修改，大大提升了性能。
修改以后经过diff算法得出一些需要修改的最小单位，再将这些小单位的视图进行更新。这样做减少了很多不需要的DOM操作，大大提高了性能。

打个比方，比如说我现在有这么一个VNode树：
  {
      tag: 'div'
      data: {
          class: 'test'
      },
      children: [
          {
              tag: 'span',
              data: {
                  class: 'demo'
              }
              text: 'hello,VNode'
          }
      ]
  }
渲染之后的结果就是这样的：
  <div class="test">
      <span class="demo">hello,VNode</span>
  </div>
*/

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
/* 
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
*/
/*
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
// render函数的第二个参数：作用是生成一个虚拟DOM
export function createElement (
  context: Component, // context 表示 VNode 的上下文环境
  tag: any, // tag 表示标签
  data: any, // data 表示 VNode 的数据，它是一个 VNodeData 类型，可以在 flow/vnode.js 中找到它的定义（data参数可以是没有的）
  children: any, // children 表示当前 VNode 的子节点，它是任意类型的，它接下来需要被规范为标准的 VNode 数组
  normalizationType: any, // normalizationType 表示子节点规范的类型，类型不同规范的方法也就不一样，它主要是参考 render 函数是编译生成的还是用户手写的(true)
  alwaysNormalize: boolean
): VNode {
  // data没有传，只传了三个参数
  if (Array.isArray(data) || isPrimitive(data)) {
    // data值传给children
    // children值传给normalizationType
    // 将data置空
    normalizationType = children
    children = data
    data = undefined
  }
  // alwaysNormalize传入的值时true的话
  if (isTrue(alwaysNormalize)) {
    // normalizationType = 2
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

// 
export function _createElement (
  context: Component, // context 表示 VNode 的上下文环境
  tag?: string | Class<Component> | Function | Object, // tag 表示标签
  data?: VNodeData, // data 表示 VNode 的数据，它是一个 VNodeData 类型，可以在 flow/vnode.js 中找到它的定义
  children?: any, // children 表示当前 VNode 的子节点，它是任意类型的，它接下来需要被规范为标准的 VNode 数组
  normalizationType?: number // normalizationType 表示子节点规范的类型，类型不同规范的方法也就不一样，它主要是参考 render 函数是编译生成的还是用户手写的(true)
): VNode {
  // 不允许vNode的data是响应式的
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    // 创建一个注释VNode节点
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // component.is有这个属性
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  // component.is不是真值也返回一个注释VNode节点
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) { // data.key不是基本类型
    warn(
      'Avoid using non-primitive value as key, ' +
      'use string/number value instead.',
      context
    )
  }
  // support single function children as default scoped slot
  // 对scope和slot的处理，后续补上------------
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }

  // children数组嵌套数组不止是一层：递归变为一维数组
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  }
  // children数组嵌套数组最多是一层：变为一维数组
  else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }

  let vnode, ns
  // tag是字符串
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // 创建VNode节点：tag是平台保留的tag
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // render函数最终返回的虚拟DOM节点
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    }
    // 解析组件
    else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    }
    // 创建VNode节点
    else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } 
  // tag不是字符串：解析组件
  else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }

  // vnode存在返回vnode
  if (isDef(vnode)) {
    if (ns) applyNS(vnode, ns)
    return vnode
  }
  // vnode不存在返回空节点
  else {
    return createEmptyVNode()
  }
}

function applyNS (vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (isUndef(child.ns) || isTrue(force))) {
        applyNS(child, ns, force)
      }
    }
  }
}
