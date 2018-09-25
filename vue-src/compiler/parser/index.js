/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { cached, no, camelize } from 'shared/util'
import { genAssignmentCode } from '../directives/model'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  pluckModuleFunction
} from '../helpers'

/* 
  一、这个常量用来匹配以字符 @ 或 v-on: 开头的字符串，
  二、主要作用是检测标签属性名是否是监听事件的指令 
*/
export const onRE = /^@|^v-on:/
/*
  一、它用来匹配以字符 v- 或 @ 或 : 开头的字符串，主要作用是检测标签属性名是否是指令。
  二、在 vue 中所有以 v- 开头的属性都被认为是指令，另外 @ 字符是 v-on 的缩写，: 字符是 v-bind 的缩写。
*/
export const dirRE = /^v-|^@|^:/
/*
  一、该正则包含三个分组：
      1、第一个分组为 ([^]*?)，该分组是一个惰性匹配的分组，它匹配的内容为任何字符，包括换行符等。
      2、第二个分组为 (?:in|of)，该分组用来匹配字符串 in 或者 of，并且该分组是非捕获的分组。
      3、第三个分组为 ([^]*)，与第一个分组类似，不同的是第三个分组是非惰性匹配。同时每个分组之间都会匹配至少一个空白符 \s+。
  
  二、通过以上说明可知，正则 forAliasRE 用来匹配 v-for 属性的值，并捕获 in 或 of 前后的字符串。假设我们像如下这样使用 v-for：
      <div v-for="obj of list"></div>
      那么正则 forAliasRE 用来匹配字符串 'obj of list'，并捕获到两个字符串 'obj' 和 'list'。
*/
export const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/
/*
  一、该正则用来匹配 forAliasRE第一个捕获组所捕获到的字符串，可以看到正则中拥有三个分组，有两个捕获的分组，
      1、第一个捕获组用来捕获一个不包含字符 ,} 和 ] 的字符串，且该字符串前面有一个字符 ,，如：', index'。
      2、第二个分组为非捕获的分组，
      3、第三个分组为捕获的分组，其捕获的内容与第一个捕获组相同。

  二、举几个例子，我们知道 v-for 有几种不同的写法
    1、其中一种使用 v-for 的方式是：
      <div v-for="obj of list"></div>
      如果像如上这样使用 v-for，那么 forAliasRE 正则的第一个捕获组的内容为字符串 'obj'，
      此时使用 forIteratorRE 正则去匹配字符串 'obj' 将得不到任何内容。

    2、第二种使用 v-for 的方式为：
      <div v-for="(obj, index) of list"></div>
      此时 forAliasRE 正则的第一个捕获组的内容为字符串 '(obj, index)'，如果去掉左右括号则该字符串为 'obj, index'，
      如果使用 forIteratorRE 正则去匹配字符串 'obj, index' 则会匹配成功，
      并且 forIteratorRE 正则的第一个捕获组将捕获到字符串 'index'，但第二个捕获组捕获不到任何内容。

    3、第三种使用 v-for 的方式为：
      <div v-for="(value, key, index) in object"></div>
      以上方式主要用于遍历对象而非数组，此时 forAliasRE 正则的第一个捕获组的内容为字符串 '(value, key, index)'，
      如果去掉左右括号则该字符串为 'value, key, index'，
      如果使用 forIteratorRE 正则去匹配字符串 'value, key, index' 则会匹配成功，
      并且 forIteratorRE 正则的第一个捕获组将捕获到字符串 'key'，但第二个捕获组将捕获到字符串 'index'
*/
export const forIteratorRE = /\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/
/*
  一、正则 argRE 用来匹配指令中的参数，如下：
      <div v-on:click.stop="handleClick"></div>
  二、其中 v-on 为指令，click 为传递给 v-on 指令的参数，stop 为修饰符。
      所以 argRE 正则用来匹配指令编写中的参数，并且拥有一个捕获组，用来捕获参数的名字
*/
const argRE = /:(.*)$/
/*
  一、该正则用来匹配以字符 : 或字符串 v-bind: 开头的字符串，
  二、主要用来检测一个标签的属性是否是绑定(v-bind)
*/
const bindRE = /^:|^v-bind:/
/*
  一、该正则用来匹配修饰符的，但是并没有捕获任何东西，举例如下：
      const matchs = 'v-on:click.stop'.match(modifierRE)
      那么 matchs 数组第一个元素为字符串 '.stop'，

  二、所以指令修饰符应该是：
      matchs[0].slice(1)  // 'stop'
*/
const modifierRE = /\.[^.]+/g

/*
  一、cached 函数的作用是接收一个函数作为参数并返回一个新的函数，
      新函数的功能与作为参数传递的函数功能相同，唯一不同的是新函数具有缓存值的功能，
      如果一个函数在接收相同参数的情况下所返回的值总是相同的，那么 cached 函数将会为该函数提供性能提升的优势。

  二、可以看到传递给 cached 函数的参数是 he.decode 函数，其中 he 为第三方的库，he.decode 函数用于 HTML 字符实体的解码工作，如：
      console.log(he.decode('&#x26;'))  // &#x26; -> '&'
      由于字符实体 &#x26; 代表的字符为 &。所以字符串 &#x26; 经过解码后将变为字符 &。
  三、decodeHTMLCached 函数在后面将被用于对纯文本的解码，如果不进行解码，那么用户将无法使用字符实体编写字符。
*/
const decodeHTMLCached = cached(he.decode)

/*
  一、定义了 8 个平台化的变量
  二、可以清晰的看到在 parse 函数的一开始为这 8 个平台化的变量进行了初始化，初始化的值都是我们曾经讲过的编译器的选项参数，
  三、由于我们前面所讲解的都是 web 平台下的编译器选项，所以这里初始化的值都只用于 web 平台
*/
// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

type Attr = { name: string; value: string };

/**
 * [createASTElement 创建一个元素的描述对象]
 * @param  {[type]} tag:    string            [标签名]
 * @param  {[type]} attrs:  Array<Attr>       [标签属性列表]
 * @param  {[type]} parent: ASTElement | void [标签父级节点]
 * @return {[type]}                           [description]
 */
export function createASTElement (
  tag: string,
  attrs: Array<Attr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1, /* 指的节点类型，1为元素节点 */
    tag, /*节点名称*/
    parent, /*父级节点*/
    attrsList: attrs, /*属性列表*/
    attrsMap: makeAttrsMap(attrs), /*将标签的属性数组转换成名值对一一对象的对！！！*/
    children: [] /*子节点列表*/
  }
}

/**
 * Convert HTML string to AST.
 */
/**
 * [parse 将字符串模板解析为抽象语法树(AST)]
 * @param  {[type]} template: string          [字符串模板]
 * @param  {[type]} options:  CompilerOptions [选项参数]
 * @return {[type]}           [AST抽象语法树]
 */
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  /*
    一、warn 变量的值为 options.warn 函数，如果 options.warn 选项参数不存在，则会降级使用 baseWarn 函数，
    二、所以 warn 函数作用是用来打印警告信息的
  */
  warn = options.warn || baseWarn

  /*
    一、该函数是一个编译器选项，其作用是通过给定的标签名字判断该标签是否是 pre 标签。
    二、另外如上代码所示如果编译器选项中不包含 options.isPreTag 函数则会降级使用 no 函数，该函数是一个空函数，即什么都不做。
  */
  platformIsPreTag = options.isPreTag || no
  /*
    一、该函数也是一个编译器选项，其作用是用来检测一个属性在标签中是否要使用元素对象原生的 prop 进行绑定，
    二、注意：这里的 prop 指的是元素对象的属性，而非 Vue 中的 props 概念。
        同样的如果选项参数中不包含 options.mustUseProp 函数则会降级为 no 函数。
  */
  platformMustUseProp = options.mustUseProp || no
  /*
    一、该函数是一个编译器选项，其作用是用来获取元素(标签)的命名空间。
    二、如果选项参数中不包含 options.getTagNamespace 函数则会降级为 no 函数。
  */
  platformGetTagNamespace = options.getTagNamespace || no

  /*
    options.modules = [
      {
        staticKeys: ['staticClass'],
        transformNode,
        genData
      },
      {
        staticKeys: ['staticStyle'],
        transformNode,
        genData
      },
      {
        preTransformNode
      }
    ]
    转换成：
    [
      transformNode,
      transformNode
    ]
  */
  transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  /*
    由于 options.modules 数组中的三个元素对象都不包含 postTransformNode 函数，所以最终 postTransforms 变量的值将是一个空数组：
    preTransforms = []
  */
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  /*它的值为 options.delimiters 属性，它的值就是在创建 Vue 实例对象时所传递的 delimiters 选项，它是一个数组。*/
  delimiters = options.delimiters

  /*
    一、我们需要每当遇到一个非一元标签的结束标签时，都将 currentParent 变量的值回退到之前的元素描述对象，
        这样就能够保证当前正在解析的标签拥有正确的父级
    二、若要回退之前的值，那么必然需要一个变量保存之前的值，所以我们需要一个数组 stack
  */
  const stack = []
  /*
    一、它是一个布尔值并且它的值与编译器选项中的 options.preserveWhitespace 选项有关，
    二、只要 options.preserveWhitespace 的值不为 false，那么 preserveWhitespace 的值就为真
    三、其中 options.preserveWhitespace 选项用来告诉编译器在编译 html 字符串时是否放弃标签之间的空格，如果为 true 则代表放弃
  */
  const preserveWhitespace = options.preserveWhitespace !== false
  /* 
    一、root 所代表的就是整棵 AST，parse 函数体中间的所有代码都是为了充实 root 变量。
    二、该变量为 parse 函数的返回值，即最终的 AST
  */
  let root
  /*
    一、它的作用是每遇到一个非一元标签，都会将该标签的描述对象作为 currentParent 的值，
        这样当解析该非一元标签的子节点时，子节点的父级就是 currentParent 变量。
    二、另外在 start 钩子函数内部我们在创建 element 描述对象时，
        使用 currentParent 的值作为每个元素描述对象的 parent 属性的值。
  */
  let currentParent
  /*inVPre 变量用来标识当前解析的标签是否在拥有 v-pre 的标签之内*/
  let inVPre = false
  /*inPre 变量用来标识当前正在解析的标签是否在 <pre></pre> 标签之内*/
  let inPre = false
  /*warned 变量则用于接下来定义的 warnOnce 函数*/
  let warned = false

  /*warnOnce 函数同样是用来打印警告信息的函数
    一、warnOnce 函数就如它的名字一样，只会打印一次警告信息，
    二、warnOnce 函数也是通过调用 warn 函数来实现的。
  */
  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }
  /*每当遇到一个标签的结束标签时，或遇到一元标签时都会调用该方法“闭合”标签*/
  function endPre (element) {
    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
  }


  /*
    一、parseHTML: 对模板字符串进行解析，实际上 parseHTML 函数的作用就是用来做词法分析的，
    二、parse: parse函数的作用则是在词法分析的基础上做句法分析从而生成一棵 AST
    三、parseHTML函数四个钩子函数选项：
        1、start 钩子函数，在解析 html 字符串时每次遇到 开始标签 时就会调用该函数
        2、end 钩子函数，在解析 html 字符串时每次遇到 结束标签 时就会调用该函数
        3、chars 钩子函数，在解析 html 字符串时每次遇到 纯文本 时就会调用该函数
        4、comment 钩子函数，在解析 html 字符串时每次遇到 注释节点 时就会调用该函
  */
  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldKeepComment: options.comments,
    /*钩子函数*/
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      /*定义 element 常量，它就是元素节点的描述对象*/
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        processFor(element)
        processIf(element)
        processOnce(element)
        // element-scope stuff
        processElement(element, options)
      }

      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.tag === 'slot' || el.tag === 'template') {
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }

      // tree management
      /*判断 root 是否存在，如果不存在则直接将 element 赋值给 root*/
      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }
      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          processIfConditions(element, currentParent)
        } else if (element.slotScope) { // scoped slot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }

      /*当一个元素为非一元标签时，会设置 currentParent 为该元素的描述对象*/
      if (!unary) {
        currentParent = element
        /*
          一、将 currentParent 添加到 stack 数组
          二、目的是在end钩子函数中每当遇到一个非一元标签的结束标签时，都会回退 currentParent 变量的值为之前的值，
              这样我们就修正了当前正在解析的元素的父级元素。
        */
        stack.push(element)
      } else {
        endPre(element)
      }
      // apply post-transforms
      for (let i = 0; i < postTransforms.length; i++) {
        postTransforms[i](element, options)
      }
    },

    end () {
      // remove trailing whitespace
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      /*
        每当遇到一个非一元标签的结束标签时，都会回退 currentParent 变量的值为之前的值，
        这样我们就修正了当前正在解析的元素的父级元素。
      */
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      endPre(element)
    },

    chars (text: string) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      text = inPre || text.trim()
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        : preserveWhitespace && children.length ? ' ' : ''
      if (text) {
        let expression
        if (!inVPre && text !== ' ' && (expression = parseText(text, delimiters))) {
          children.push({
            type: 2,
            expression,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    comment (text: string) {
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })
  return root
}

/**
 * [makeAttrsMap 将标签的属性数组转换成名值对一一对象的对]
 * @param  {[type]} attrs: Array<Object> [parseHTML解析出的属性]
 * @return {[type]}        [description]
 */
function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  /*遍历属性值*/
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    /*
      一、如果标签的属性数组 attrs 为：
          attrs = [
            {
              name: 'v-for',
              value: 'obj of list'
            },
            {
              name: 'class',
              value: 'box'
            }
          ]
      二、那么最终生成的 map 对象则是：
          map = {
            'v-for': 'obj of list',
            'class': 'box'
          }
    */
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

export function processElement (element: ASTElement, options: CompilerOptions) {
  processKey(element)

  // determine whether this is a plain element after
  // removing structural attributes
  element.plain = !element.key && !element.attrsList.length

  processRef(element)
  processSlot(element)
  processComponent(element)
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  processAttrs(element)
}

function processKey (el) {
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    el.key = exp
  }
}

function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    el.refInFor = checkInFor(el)
  }
}

export function processFor (el: ASTElement) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const inMatch = exp.match(forAliasRE)
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid v-for expression: ${exp}`
      )
      return
    }
    el.for = inMatch[2].trim()
    const alias = inMatch[1].trim()
    const iteratorMatch = alias.match(forIteratorRE)
    if (iteratorMatch) {
      el.alias = iteratorMatch[1].trim()
      el.iterator1 = iteratorMatch[2].trim()
      if (iteratorMatch[3]) {
        el.iterator2 = iteratorMatch[3].trim()
      }
    } else {
      el.alias = alias
    }
  }
}

function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}

function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`
        )
      }
      children.pop()
    }
  }
}

export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

function processSlot (el) {
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  } else {
    let slotScope
    if (el.tag === 'template') {
      slotScope = getAndRemoveAttr(el, 'scope')
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && slotScope) {
        warn(
          `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
          true
        )
      }
      el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
      el.slotScope = slotScope
    }
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
      // preserve slot as an attribute for native shadow DOM compat
      // only for non-scoped slots.
      if (!el.slotScope) {
        addAttr(el, 'slot', slotTarget)
      }
    }
  }
}

function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true
      // modifiers
      modifiers = parseModifiers(name)
      if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // v-bind
        name = name.replace(bindRE, '')
        value = parseFilters(value)
        isProp = false
        if (modifiers) {
          if (modifiers.prop) {
            isProp = true
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel) {
            name = camelize(name)
          }
          if (modifiers.sync) {
            addHandler(
              el,
              `update:${camelize(name)}`,
              genAssignmentCode(value, `$event`)
            )
          }
        }
        if (isProp || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          addProp(el, name, value)
        } else {
          addAttr(el, name, value)
        }
      } else if (onRE.test(name)) { // v-on
        name = name.replace(onRE, '')
        addHandler(el, name, value, modifiers, false, warn)
      } else { // normal directives
        name = name.replace(dirRE, '')
        // parse arg
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        addDirective(el, name, rawName, value, arg, modifiers)
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const expression = parseText(value, delimiters)
        if (expression) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
    }
  }
}

function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}
