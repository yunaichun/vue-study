/* @flow */

import { namespaceMap } from 'web/util/index'

// 创建DOM
export function createElement (tagName: string, vnode: VNode): Element {
  const elm = document.createElement(tagName)
  if (tagName !== 'select') {
    return elm
  }
  // false or null will remove the attribute but undefined will not
  if (vnode.data && vnode.data.attrs && vnode.data.attrs.multiple !== undefined) {
    elm.setAttribute('multiple', 'multiple')
  }
  return elm
}

// 创建带有指定命名空间的元素节点
export function createElementNS (namespace: string, tagName: string): Element {
  return document.createElementNS(namespaceMap[namespace], tagName)
}

// 创建文本节点
export function createTextNode (text: string): Text {
  return document.createTextNode(text)
}

// 创建注释节点
export function createComment (text: string): Comment {
  return document.createComment(text)
}

// 插入元素
export function insertBefore (parentNode: Node, newNode: Node, referenceNode: Node) {
  parentNode.insertBefore(newNode, referenceNode)
}

// 移除元素
export function removeChild (node: Node, child: Node) {
  node.removeChild(child)
}

// 添加元素
export function appendChild (node: Node, child: Node) {
  node.appendChild(child)
}

// 获取父节点
export function parentNode (node: Node): ?Node {
  return node.parentNode
}

// 获取下一个兄弟节点
export function nextSibling (node: Node): ?Node {
  return node.nextSibling
}

// 获取标签名称
export function tagName (node: Element): string {
  return node.tagName
}

// DOM添加文本
export function setTextContent (node: Node, text: string) {
  node.textContent = text
}

// 设置DOM属性
export function setAttribute (node: Element, key: string, val: string) {
  node.setAttribute(key, val)
}
