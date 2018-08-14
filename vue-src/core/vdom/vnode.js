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
// 创建虚拟DOM节点
export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  functionalContext: Component | void; // real context vm for functional nodes
  functionalOptions: ?ComponentOptions; // for SSR caching
  functionalScopeId: ?string; // functioanl scope id support

  constructor (
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    // 当前节点的标签名
    this.tag = tag
    // 当前节点对应的对象，包含了具体的一些数据信息，是一个VNodeData类型，可以参考VNodeData类型中的数据信息
    this.data = data
    // 当前节点的子节点，是一个数组
    this.children = children
    // 当前节点的文本
    this.text = text
    // 当前虚拟节点对应的真实dom节点
    this.elm = elm
    // 当前节点的名字空间
    this.ns = undefined
    // 当前节点的编译作用域
    this.context = context
    // 函数化组件作用域
    this.functionalContext = undefined
    this.functionalOptions = undefined
    this.functionalScopeId = undefined
    // 节点的key属性，被当作节点的标志，用以优化
    this.key = data && data.key
    // 组件的option选项
    this.componentOptions = componentOptions
    // 当前节点对应的组件的实例
    this.componentInstance = undefined
    // 当前节点的父节点
    this.parent = undefined
    // 简而言之就是是否为原生HTML或只是普通文本，innerHTML的时候为true，textContent的时候为false
    this.raw = false
    // 是否为静态节点
    this.isStatic = false
    // 是否作为跟节点插入
    this.isRootInsert = true
    // 是否为注释节点
    this.isComment = false
    // 是否为克隆节点
    this.isCloned = false
    // 是否有v-once指令
    this.isOnce = false
    // 是否是异步
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  // 返回当前节点对应的组件的实例
  get child (): Component | void {
    return this.componentInstance
  }
}

// 创建一个空VNode节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

// 创建一个文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/* 克隆一个VNode节点
  优化浅拷贝用于静态节点和slot节点，因为它们可以在多个render函数中重用，
  DOM操作依赖于它们的elm引用，避免浅拷贝出错。
*/
export function cloneVNode (vnode: VNode, deep?: boolean): VNode {
  // vnode为准备拷贝的源对象
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  // 当前节点的名字空间
  cloned.ns = vnode.ns
  // 是否为静态节点
  cloned.isStatic = vnode.isStatic
  // 节点的key属性，被当作节点的标志，用以优化
  cloned.key = vnode.key
  // 是否为注释节点
  cloned.isComment = vnode.isComment
  // 是否为克隆节点设置为true
  cloned.isCloned = true
  // 深拷贝选项
  if (deep && vnode.children) {
    cloned.children = cloneVNodes(vnode.children)
  }
  // 返回拷贝的节点
  return cloned
}

// 对一个节点数组依次进行clone
export function cloneVNodes (vnodes: Array<VNode>, deep?: boolean): Array<VNode> {
  // 节点数组
  const len = vnodes.length
  const res = new Array(len)
  // 遍历节点数组
  for (let i = 0; i < len; i++) {
    res[i] = cloneVNode(vnodes[i], deep)
  }
  // 返回拷贝的节点数组
  return res
}
