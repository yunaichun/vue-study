/* @flow */

import { makeMap } from 'shared/util'

// isUnaryTag 是一个通过 makeMap 生成的函数，该函数的作用是检测给定的标签是否是一元标签
export const isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
  'link,meta,param,source,track,wbr'
)

// Elements that you can, intentionally, leave open
// (and which close themselves)
/*
比如 p 标签是一个双标签，你需要这样使用 <p>Some content</p>，但是你依然可以省略闭合标签，
直接这样写：<p>Some content，且浏览器会自动补全。
但是有些标签你不可以这样用，它们是严格的双标签。
*/
// canBeLeftOpenTag 是一个通过 makeMap 生成的函数，它的作用是检测一个标签是否是那些虽然不是一元标签，但却可以自己补全并闭合的标签。
export const canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
)

// HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content
export const isNonPhrasingTag = makeMap(
  'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
  'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
  'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
  'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
  'title,tr,track'
)
