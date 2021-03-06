/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-slots'


/**
 * [installRenderHelpers 在 Vue.prototype 上添加一系列方法]
 * @param  {[type]} target: any           [Vue.prototype]
 * @return {[type]}                       [description]
 */
export function installRenderHelpers (target: any) {
  target._o = markOnce // 
  target._n = toNumber
  target._s = toString //  render函数创建文本节点内容 {{ a }}
  target._l = renderList // reder函数中用v-for
  target._t = renderSlot
  target._q = looseEqual
  target._i = looseIndexOf
  target._m = renderStatic // 
  target._f = resolveFilter
  target._k = checkKeyCodes
  target._b = bindObjectProps
  target._v = createTextVNode // render函数创建文本节点 {{ a }}
  target._e = createEmptyVNode
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
}
