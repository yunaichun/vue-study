/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */
/*
  parseHTML: 对模板字符串进行解析，实际上 parseHTML 函数的作用就是用来做词法分析的，
  parse: parse函数的作用则是在词法分析的基础上做句法分析从而生成一棵 AST
*/


import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'


/* 匹配标签属性名
  一、匹配标签的属性 (attributes) 正则分析
      1、匹配属性名：^\s*([^\s"'<>\/=]+)
      2、匹配等于号：?:\s*(=)\s*
      3：匹配属性值："([^"]*)"+    、   '([^']*)'+    、    ([^\s"'=<>`]+)

  二、需要三个捕获组都来匹配属性值，是因为html 标签中有4种写属性值的方式：
      1、使用双引号把值引起来：class="some-class"
      2、使用单引号把值引起来：class='some-class'
      3、不使用引号：class=some-class
      4、单独的属性名：disabled

  三、正因如此，需要三个正则分组并配合可选属性来分别匹配四种情况，我们可以对这个正则做一个测试，如下：
      const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
      1、console.log('class="some-class"'.match(attribute))  // 测试双引号
      2、console.log("class='some-class'".match(attribute))  // 测试单引号
      3、console.log('class=some-class'.match(attribute))  // 测试无引号
      4、console.log('disabled'.match(attribute))  // 测试无属性值

      匹配为一个数组：第一项是整个内容。第二-六项是五个分组，后两项为undefined因为没有捕获到内容

  四、匹配结果
      1、属性双引号
          [
              'class="some-class"',
              'class',
              '=',
              'some-class',
              undefined,
              undefined
          ]
      2、属性单引号
          [
              "class='some-class'",
              'class',
              '=',
              undefined,
              'some-class',
              undefined
          ]
      3、属性没有引号
          [
            'class=some-class',
            'class',
            '=',
            undefined,
            undefined,
            'some-class'
          ]
      4、单独的属性名
          [
            'disabled',
            'disabled',
            undefined,
            undefined,
            undefined,
            undefined
          ]
*/
// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/* 匹配标签名称
  一、合法的 XML 名称是什么样的？
      首先在 XML 中，标签是用户自己定义的，比如：<bug></bug>。
      正因为这样，所以不同的文档中如果定义了相同的元素(标签)，就会产生冲突，为此，XML 允许用户为标签指定前缀：<k:bug></k:bug>，前缀是字母 k。

      除了前缀还可以使用命名空间，即使用标签的 xmlns 属性，为前缀赋予与指定命名空间相关联的限定名称：
      <k:bug xmlns:k="http://www.xxx.com/xxx"></k:bug>
      综上所述，一个合法的XML标签名应该是由 前缀、冒号(:) 以及 标签名称 组成的：<前缀:标签名称>

  二、什么是 ncname？
      ncname 的全称是 An XML name that does not contain a colon (:) 即：不包含冒号(:)的 XML 名称。
      也就是说 ncname 就是不包含前缀的XML标签名称。大家可以在这里找到关于 ncname 的概念。

  三、什么是 qname？
      我们可以在 Vue 的源码中看到其给出了一个链接：https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName，
      其实 qname 就是：<前缀:标签名称>，也就是合法的XML标签。

      了解了这些，我们再来看 ncname 的正则表达式，它定义了 ncname 的合法组成，
      这个正则所匹配的内容很简单：字母或下划线开头，后面可以跟任意数量的字符、中横线和 .。
*/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
/*匹配开始标签的 < 以及标签的名字*/
const startTagOpen = new RegExp(`^<${qnameCapture}`)
/*匹配开始标签的闭合部分，即：> 或者 />*/
const startTagClose = /^\s*(\/?)>/
/*用来匹配结束标签*/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
/*用来匹配文档的 DOCTYPE 标签，没有捕获组*/
const doctype = /^<!DOCTYPE [^>]+>/i
/*用来匹配注释节点，没有捕获组*/
const comment = /^<!--/
/*用来匹配条件注释节点，没有捕获组，如：<!--[if IE]>*/
const conditionalComment = /^<!\[/
/*标识当前宿主环境是否是老版的火狐浏览器
  首先定义了变量 IS_REGEX_CAPTURING_BROKEN 且初始值为 false，
  接着使用一个字符串 'x' 的 replace 函数用一个带有捕获组的正则进行匹配，并将捕获组捕获到的值赋值给变量 g。

  我们观察字符串 'x' 和正则 /x(.)?/ 可以发现，该正则中的捕获组应该捕获不到任何内容，所以此时 g 的值应该是 undefined，
  但是在老版本的火狐浏览器中存在一个问题，此时的 g 是一个空字符串 ''，并不是 undefined。
  所以变量 IS_REGEX_CAPTURING_BROKEN 的作用就是用来标识当前宿主环境是否存在该问题。
*/
let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})


// Special Elements (can contain anything)
/*通过 makeMap 函数生成的一个函数，用来检测给定的标签名字是不是纯文本标签（包括：script、style、textarea）*/
export const isPlainTextElement = makeMap('script,style,textarea', true)
/*被初始化为一个空的 JS 对象*/
const reCache = {}
/* 
  一、decodingMap 以及两个正则 encodedAttr 和 encodedAttrWithNewLines 的作用就是用来完成对 html 实体进行解码的
  二、和shouldDecodeNewlines参数相关
  三、当shouldDecodeNewlines设为 true 时，意味着 Vue 在编译模板的时候，要对属性值中的换行符做兼容处理
*/
const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10);/g


// #5992
/*
一、这两句代码的作用是用来解决一个问题，该问题是由于历史原因造成的，
    即一些元素会受到额外的限制，比如 <pre> 标签和 <textarea> 会忽略其内容的第一个换行符，所以下面这段代码是等价的：
    <pre>内容</pre>

    等价于：
    <pre>
    内容</pre>
二、如果满足：标签是 pre 或者 textarea 且 标签内容的第一个字符是换行符，则返回 true，否则为 false。
*/
/*通过 makeMap 函数生成的函数，用来检测给定的标签是否是 <pre> 标签或者 <textarea> 标签*/
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
/*用来检测是否应该忽略元素内容的第一个换行符*/
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'


/*
  一、decodeAttr 函数是用来解码 html 实体的。
  二、它的原理是利用前面讲过的正则 encodedAttrWithNewLines 和 encodedAttr 以及 html 实体与字符
      一一对应的 decodingMap 对象来实现将 html 实体转为对应的字符。
*/
function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}


export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd))
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      if (textEnd < 0) {
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!--([\s\S]*?)-->/g, '$1')
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        value: decodeAttr(
          value,
          options.shouldDecodeNewlines
        )
      }
    }

    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
