/* @flow */

import { cached, extend, toObject } from 'shared/util'

/**
 * [parseStyleText 对非绑定的style属性值的解析]
 * @param  {Object} cssText  [解析出的非绑定的style属性值]
 * @return {[type]}          [返回一个对象]
 */
export const parseStyleText = cached(function (cssText) {
  const res = {}
  /*该正则表达式使用了 正向否定查找((?!)，什么是正向否定查找呢？
    一、举个例子，正则表达式 /a(?!b)/用来匹配后面没有跟字符 'b' 的字符 'a'。
        所以listDelimiter正则表达式用来全局匹配字符串中的分号(;)，
        但是该分号必须满足一个条件，即 该分号的后面不能跟左圆括号())，除非有一个相应的右圆括号(()存在。

    二、说起来有点抽象，如下模板：
        <div style="color: red; background: url(www.xxx.com?a=1&amp;copy=3);"></div>
        如上 div 标签的 style 属性值中存在几个分号？答案是三个分号，但只有其中两个分号才是真正的样式规则分割符，
        而字符串 'url(www.xxx.com?a=1&amp;copy=3)' 中的分号则是不能作为样式规则分割符的，正则常量 listDelimiter 正是为了实现这个功能而设计的。

    三、为什么 url 中会带有分号(;)，实际上正如上面的例子所示，我们知道内联样式是写在 html 文件中的，
        在 html 规范中存在一个叫做 html实体 的概念，如下 html 模板：<a href="foo.cgi?chapter=1&copy=3">link</a>
        这段 html 模板在一些浏览器中不能正常工作，这是因为有些浏览器会把 &copy 当做 html 实体从而把其解析为字符 ©，
        这就导致当你打开该链接时，变成了访问：foo.cgi?chapter=1©=3。
  */
  const listDelimiter = /;(?![^(]*\))/g
  const propertyDelimiter = /:(.+)/
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      var tmp = item.split(propertyDelimiter)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res
})
  
// merge static and dynamic style data on the same vnode
function normalizeStyleData (data: VNodeData): ?Object {
  const style = normalizeStyleBinding(data.style)
  // static style is pre-processed into an object during compilation
  // and is always a fresh object, so it's safe to merge into it
  return data.staticStyle
    ? extend(data.staticStyle, style)
    : style
}

// normalize possible array / string values into Object
export function normalizeStyleBinding (bindingStyle: any): ?Object {
  if (Array.isArray(bindingStyle)) {
    return toObject(bindingStyle)
  }
  if (typeof bindingStyle === 'string') {
    return parseStyleText(bindingStyle)
  }
  return bindingStyle
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 */
export function getStyle (vnode: VNode, checkChild: boolean): Object {
  const res = {}
  let styleData

  if (checkChild) {
    let childNode = vnode
    while (childNode.componentInstance) {
      childNode = childNode.componentInstance._vnode
      if (childNode.data && (styleData = normalizeStyleData(childNode.data))) {
        extend(res, styleData)
      }
    }
  }

  if ((styleData = normalizeStyleData(vnode.data))) {
    extend(res, styleData)
  }

  let parentNode = vnode
  while ((parentNode = parentNode.parent)) {
    if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
      extend(res, styleData)
    }
  }
  return res
}

