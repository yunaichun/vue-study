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
/*makeMap生成的函数，意思是不能是 段落式内容(Phrasing content) 模型标签*/
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
/*标识当前宿主环境是否是老版的火狐浏览器[var a = 'x'.match(/x(.)?/g) ; chrom捕获的是undefined，但是老版本捕获的是'']
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


/**
 * [parseHTML 词法解析]
 * @param  {[type]} html    [要被 parse 的字符串]
 * @param  {[type]} options [是 parser 选项]
 * @return {[type]}         [description]
 */
export function parseHTML (html, options) {
  /*stack 常量以及 lastTag 变量，其目的是将来判断是否缺少闭合标签
    在 while 循环中处理 html 字符流的时候每当遇到一个 非一元标签，都会将该开始标签 push 到该数组
    最先遇到的结束标签，其对应的开始标签应该最后被压入 stack 栈
  */
  const stack = []
  /*是一个布尔值*/
  const expectHTML = options.expectHTML
  /*用来检测一个标签是否是一元标签*/
  const isUnaryTag = options.isUnaryTag || no
  /*用来检测一个标签是否是可以省略闭合标签的非一元标签*/
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  /*初始化为 0，它标识着当前字符流的读入位置*/
  let index = 0
  /* 
  变量 last 存储剩余还未 parse 的 html 字符串；
  变量 lastTag 则始终存储着位于 stack 栈顶的元素
  */
  let last, lastTag


  /*开启一个 while 循环，循环结束的条件是 html 为空，即 html 被 parse 完毕*/
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    /*确保即将 parse 的内容不是在纯文本标签里 (script,style,textarea)*/
    if (!lastTag || !isPlainTextElement(lastTag)) {
      /*textEnd 变量的值是 html 字符串中左尖括号(<)第一次出现的位置*/
      let textEnd = html.indexOf('<')


      /*
        当 textEnd === 0 时，说明 html 字符串的第一个字符就是左尖括号，
        比如 html 字符串为：<div>asdf</div>，那么这个字符串的第一个字符就是左尖括号(<)
      */
      if (textEnd === 0) {

        // Comment:
        /*有可能是注释节点：以 <!-- 开头，以 --> 结尾*/
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            /*调用同为 parser 选项的 options.comment 函数，并将注释节点的内容作为参数传递*/
            if (options.shouldKeepComment) {
              /*最终获取到的内容是不包含注释节点的起始(<!--)和结束(-->)的*/
              options.comment(html.substring(4, commentEnd))
            }
            /*将已经 parse 完毕的字符串剔除*/
            advance(commentEnd + 3)
            /*由于此时 html 字符串已经是去掉了 parse 过的部分的新字符串了，所以开启下一次循环，重新开始 parse 过程*/
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        /*有可能是条件注释节点：以<![ 开头，以 ]> 结尾*/
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            /* 一、对于条件注释节点则没有相应的 parser 钩子，也就是说 Vue 模板永远都不会保留条件注释节点的内容 */
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        /*doctype 节点
          一、如果匹配成功 doctypeMatch 的值是一个数组，数组的第一项保存着整个匹配项的字符串，即整个 Doctype 标签的字符串，否则 doctypeMatch 的值为 null
          二、对于 Doctype 也没有提供相应的 parser 钩子，即 Vue 不会保留 Doctype 节点的内容；原则上 Vue 在编译的时候根本不会遇到 Doctype 标签
        */
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // Start tag:
        /*开始标签*/
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          /*handleStartTag 函数用来处理 parseStartTag 的结果*/
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }

        // End tag:
        /*结束标签
          一、比如有如下 html 字符串：
              <div></div>
              则匹配后 endTagMatch 如下：

              endTagMatch = [
                '</div>',
                'div'
              ]
          二、第一个元素是整个匹配到的结束标签字符串，第二个元素是对应的标签名字。
              如果匹配成功 if 语句块的代码将被执行，首先使用 curIndex 常量存储当前 index 的值，
              然后调用 advance 函数，并以 endTagMatch[0].length 作为参数，

              接着调用了 parseEndTag 函数对结束标签进行解析，传递给 parseEndTag 函数的三个参数分别是：
              标签名、结束标签在 html 字符串中起始、结束的位置，最后调用 continue 语句结束此次循环。
        */
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }
      }


      /*
        当 textEnd >= 0 时，说明 html 字符串的第一个字符是 < 但没有成功匹配标签，或第一个字符不是 < 的字符串
        比如 html 字符串为：html = '0<1<2'
      */
      let text, rest, next
      if (textEnd >= 0) {
        /*截取了字符串 html 并将截取后的值赋值给 rest 变量，此时rest='<1<2'*/
        rest = html.slice(textEnd)
        /*
          截取后的字符串是 <1<2，依然是一个以符号 < 开头的字符串，所以这个字符串很有可能匹配成标签，
          而 while 循环的条件保证了只有截取后的字符串不能匹配标签的情况下才会执行，这说明符号 < 存在于普通文本中。
        */
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          /*寻找下一个符号 < 的位置，并将位置索引存储在 next 变量中*/
          next = rest.indexOf('<', 1)
          if (next < 0) break
          /*更新 textEnd 的值，更新后的 textEnd 的值将是第二个 < 符号的索引*/
          textEnd += next
          /*使用新的 textEnd 对原始字符串 html 进行截取，并将新截取的字符串赋值给 rest 变量
            如此往复直到遇到一个能够成功匹配标签的 < 符号为止，
            或者当再也遇不到下一个 < 符号时，while 循环会 break，此时循环也会终止。
          */
          rest = html.slice(textEnd)
        }
        /*
          如果字符串 html 为 0<1<2，此时 textEnd 保存着字符串中第二个 < 符号的位置索引，
          所以当循环终止时变量 text 的值将是 0<1
        */
        text = html.substring(0, textEnd)
        advance(textEnd)
      }


      if (textEnd < 0) {
        text = html
        html = ''
      }


      /* 
        如果字符串 html 为 0<1<2，我们知道此时 textEnd 保存着字符串中第二个 < 符号的位置索引，
        所以当循环终止时变量 text 的值将是 0<1，此时 text 的值为字符串 0<1，
        所以这部分字符串将被作为普通字符串处理，如果 options.chars 存在，则会调用该钩子函数并将字符串传递过去。
      */
      if (options.chars && text) {
        options.chars(text)
      }
    } 
    /*lastTag && isPlainTextElement(lastTag)
      最近一次遇到的非一元标签是纯文本标签(即：script,style,textarea 标签)。
      也就是说：当前我们正在处理的是纯文本标签里面的内容(script,style,textarea)。
    */
    else {
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

    /*将整个字符串作为文本对待
      如果两者相等，则说明字符串 html 在经历循环体的代码之后没有任何改变，此时会把 html 字符串作为纯文本对待

      一、0<1<2, 剩余的字符串 <2 呢？这部分字符串将会在下一次整体的 while 循环处理，
          此时由于 html 字符串的值将被更新为 <2，第一个字符为 <，所以该字符的索引为 0，
          这时既会匹配 textEnd 等于 0 的情况，也会匹配 textEnd 大于等于 0 的情况，
          但是由于字符串 <2 既不能匹配标签，也不会被 textEnd 大于等于 0 的 if 语句块处理，所以代码最终会来到这里：

      二、由于字符串 html (它的值为 <2)没有被处理，
          所以当程序运行到如上这段代码时，条件 html === last 将会成立，
          所以如上这段 if 语句块的代码将被执行，可以看到在 if 语句块内，
          执行调用了 options.chars 并将整个 html 字符串作为普通字符串处理，
          换句话说最终字符串 <2 也会作为普通字符串处理。
    */
    if (html === last) {
      options.chars && options.chars(html)
      /*
        stack 栈为空代表着标签被处理完毕了，但此时仍然有剩余的字符串未处理，
        举例子假设 html 字符串为：<div></div><a，
        在解析这个字符串时首先会成功解析 div 的开始标签，此时 stack 栈中将存有 div 的开始标签，
        接着会成功解析 div 的结束标签，此时 stack 栈会被清空，
        接着会解析剩余的字符串 <a，此时由于 stack 栈被清空了，所以将满足上面 if 语句的判断条件。
      */
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  /*调用 parseEndTag 函数*/
  parseEndTag()

  /*将已经 parse 完毕的字符串剔除*/
  function advance (n) {
    /*index 变量存储着字符流的读入位置，该位置是相对于原始 html 字符串的，所以每次都要更新。*/
    index += n
    html = html.substring(n)
  }

  /*parseStartTag 函数用来 parse 开始标签
    一、当成功地匹配到一个开始标签时，假设有如下 html 字符串：
        <div v-if="isSucceed" v-for="v in map"></div>

    二、则 parseStartTag 函数的返回值如下：
        match = {
          tagName: 'div',
          attrs: [
            [
              ' v-if="isSucceed"',
              'v-if',
              '=',
              'isSucceed',
              undefined,
              undefined
            ],
            [
              ' v-for="v in map"',
              'v-for',
              '=',
              'v in map',
              undefined,
              undefined
            ]
          ],
          start: index,
          unarySlash: undefined,
          end: index
        }

    注意 match.start 和 match.end 是不同的。
  */
  function parseStartTag () {
    /*调用 html 字符串的 match 函数匹配 startTagOpen 正则*/
    const start = html.match(startTagOpen)
    /* -----匹配tagName + start-----
      一、如果匹配成功，那么 start 常量将是一个包含两个元素的数组：
          第一个元素是标签的开始部分(包含 < 和 标签名称)；
          第二个元素是捕获组捕获到的标签名称。比如有如下 html：
          <div></div>

          那么此时 start 数组为：
          start = ['<div', 'div']

      二、由于匹配成功，所以 if 语句块将被执行，首先是下面这段代码：
          if (start) {
            const match = {
              tagName: start[1],
              attrs: [],
              start: index
            }
            advance(start[0].length)
            // 省略 ...
          }

      三、定义了 match 常量，它是一个对象，初始状态下拥有三个属性：
          1、tagName：它的值为 start[1] 即标签的名称。
          2、attrs：它的初始值是一个空数组，我们知道，开始标签是可能拥有属性的，而这个数组就是用来存储将来被匹配到的属性。
          3、start：它的值被设置为 index，也就是当前字符流读入位置在整个 html 字符串中的相对位置。
    */
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      /* 开始标签的开始部分就匹配完成了，所以要调用 advance 函数，参数为 start[0].length，即匹配到的字符串的长度。*/
      advance(start[0].length)
      let end, attr
      /*  -----匹配attr-----
        一、第一个条件是：没有匹配到开始标签的结束部分，这个条件的实现方式是使用 html 字符串的 match 方法去匹配 startTagClose 正则，并将结果保存到 end 变量中。
            第二个条件是：匹配到了属性，实现方式是使用 html 字符串的 match 方法去匹配 attribute正则。

        二、简单一句话总结这个条件的成立要素：没有匹配到开始标签的结束部分，并且匹配到了开始标签中的属性，
            这个时候循环体将被执行，直到遇到开始标签的结束部分为止。

        三、比如有如下 html 字符串：
            <div v-for="v in map"></div>
            那么 attr 变量的值将为：

            attr = [
              ' v-for="v in map"',
              'v-for',
              '=',
              'v in map',
              undefined,
              undefined
            ]
      */
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        /*首先调用 advance 函数，参数为 attr[0].length 即整个属性的长度。*/
        advance(attr[0].length)
        /*然后会将此次循环匹配到的结果 push 到前面定义的 match 对象的 attrs 数组中*/
        match.attrs.push(attr)
      }
      /* -----匹配unarySlash + end-----
        一、即使匹配到了开始标签的 开始部分 以及 属性部分 但是却没有匹配到开始标签的 结束部分，则说明这根本就不是一个开始标签。
            所以只有当变量 end 存在，即匹配到了开始标签的 结束部分 时，才能说明这是一个完整的开始标签。

        二、比如当 html 字符串如下时：
            <br />
            那么匹配到的 end 的值为：
            end = ['/>', '/']

        三、如果 html 字符串如下：
            <div>
            那么 end 的值将是：
            end = ['>', undefined]

        四、所以，如果 end[1] 不为 undefined，那么说明该标签是一个一元标签。
      */
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  /*handleStartTag 函数用来处理 parseStartTag 的结果*/
  function handleStartTag (match) {
    /*开始标签的标签名*/
    const tagName = match.tagName
    /*值为 '/' 或 undefined*/
    const unarySlash = match.unarySlash

    if (expectHTML) {
      /* 开始标签是 p 标签，并且 p 标签内容标签不是 段落式内容(Phrasing content) 模型
        一、意思是最近一次遇到的开始标签是 p 标签，并且当前正在解析的开始标签必须不能是 段落式内容(Phrasing content) 模型，
            这时候 if 语句块的代码才会执行，即调用 parseEndTag(lastTag)。
        二、首先每一个 html 元素都拥有一个或多个内容模型(content model)，
            其中 p 标签本身的内容模型是 流式内容(Flow content)，
            并且 p 标签的特性是只允许包含 段落式内容(Phrasing content)。所以条件成立的情况如下：
            <p><h2></h2></p>
        三、1、在解析上面这段 html 字符串的时候，首先遇到 p 标签的开始标签，此时 lastTag 被设置为 p，
               紧接着会遇到 h2 标签的开始标签，由于 h2 标签的内容模型属于非 段落式内容(Phrasing content) 模型，
               所以会立即调用 parseEndTag(lastTag) 函数闭合 p 标签，
               此时由于强行插入了 </p> 标签，所以解析后的字符串将变为如下内容：
               <p></p><h2></h2></p>
            2、接着，继续解析该字符串，会遇到 <h2></h2> 标签并正常解析之，
            3、最后解析器会遇到一个单独的 p 标签的结束标签，即：</p>。
            4、这个时候就回到了我们前面讲过的，当解析器遇到 p 标签或者 br 标签的结束标签时会补全他们，
               最终 <p><h2></h2></p> 这段 html 字符串将被解析为：<p></p><h2></h2><p></p>
      */
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      /*检测到一个标签是可以省略闭合标签的非一元标签，并且与上一次解析到的开始标签相同
        一、当前正在解析的标签是一个可以省略结束标签的标签，并且与上一次解析到的开始标签相同，如下：
            <p>one
            <p>two
        二、p 标签是可以省略结束标签的标签，所以当解析到一个 p 标签的开始标签并且下一次遇到的标签也是 p 标签的开始标签时，会立即关闭第二个 p 标签。
            即调用：parseEndTag(tagName) 函数，
            然后由于第一个 p 标签缺少闭合标签所以会 Vue 会给你一个警告。
      */
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    /* 是一个布尔值，当它为真时代表着标签是一元标签，否则是二元标签
      简单的说 isUnaryTag 函数能够判断标准 HTML 中规定的那些一元标签，
      但是仅仅使用这一个判断条件是不够的，因为在 Vue 中我们免不了会写组件，
      而组件又是以自定义标签的形式存在的，比如：
      <my-component />
    */
    const unary = isUnaryTag(tagName) || !!unarySlash
    /*存储 match.attrs 数组的长度*/
    const l = match.attrs.length
    /*是一个与 match.attrs 数组长度相等的数组*/
    const attrs = new Array(l)
    /*
      for 循环的作用是：格式化 match.attrs 数组，并将格式化后的数据存储到常量 attrs 中。
      格式化包括两部分，
      第一：格式化后的数据只包含 name 和 value 两个字段，其中 name 是属性名，value 是属性的值。
      第二：对属性值进行 html 实体的解码。
    */
    for (let i = 0; i < l; i++) {
      /*值是每个属性的解析结果，即 match.attrs 数组中的元素对象*/
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      /* var a = 'x'.match(/x(.)?/g) ; chrom捕获的是undefined，但是老版本捕获的是''
        是用来判断老版本火狐浏览器的一个 bug 的，
        即当捕获组匹配不到值时那么捕获组对应变量的值应该是 undefined 而不是空字符串

        如果发现此时捕获到的属性值为空字符串那么就手动使用 delete 操作符将其删除
      */
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      /*
        数组的第 4、5、6 项其中之一可能会包含属性值，所以常量 value 中就保存着最终的属性值，
        如果第 4、5、6 项都没有获取到属性值，那么属性值将被设置为一个空字符串：''
      */
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        /*decodeAttr 函数的作用是对属性值中所包含的 html 实体进行解码，将其转换为实体对应的字符*/
        value: decodeAttr(
          value,
          options.shouldDecodeNewlines
        )
      }
    }

    /* 
      一、原理：最先遇到的结束标签，其对应的开始标签应该最后被压入 stack 栈
      二、例子：假设我们有如下 html 字符串：
          <article><section><div></section></article>
          stack 栈顶的元素应该是 section，但是我们发现事实上 stack 栈顶并不是 section 而是 div，
          这说明 div 元素缺少闭合标签。
          这就是检测 html 字符串中是否缺少闭合标签的原理
      三、变量 stack存储的是所有开始标签, 变量 lastTag 则始终存储着位于 stack 栈顶的元素
      
      注意：
      1、判断条件是当开始标签是非一元标签时才会执行，
      2、其目的是：如果开始标签是非一元标签，则将该开始标签的信息入栈，即 push 到 stack 数组中，
                     并将 lastTag 的值设置为该标签名。
      3、stack 常量以及 lastTag 变量，其目的是将来判断是否缺少闭合标签
    */
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }
    /*
      如果 parser 选项中包含 options.start 函数，则调用之，
      并将开始标签的名字(tagName)，格式化后的属性数组(attrs)，是否为一元标签(unary)，
      以及开始标签在原 html 中的开始和结束位置(match.start 和 match.end) 作为参数传递
    */
    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  /*parseEndTag 函数用来 parse 结束标签
    一、parseEndTag 函数主要有三个作用：
      1、检测是否缺少闭合标签(pos = 1): <article><section><div></section></article>
                                         <article><section></div></section></article>
      2、解析 </br> 与 </p> 标签，与浏览器的行为相同(pos = -1):  <body></br></p></body>
      3、处理 stack 栈中剩余的标签: <article><section></section></article><div>
                                     在解析这段 html 字符串的时候，首先会遇到两个非一元标签的开始标签，
                                     即 <article> 和 <section>，并将这两个标签 push 到 stack 栈中。
                                     然后会依次遇到与 stack 栈中起始标签相对应的结束标签 </section> 和 </article>，
                                     在解析完这两个结束标签之后 stack 栈应该是空栈!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

                                     紧接着又遇到一个开始标签，也就是 <div> 标签，这是一个非一元标签的开始标签，
                                     所以会将该标签 push 到 stack 栈中。这样上面这段 html 字符串就解析完成了，
                                     此时stack 栈非空!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                                     stack 栈中还残留最后遇到的 <div> 开始标签没有被处理，
                                     所以 parseEndTag 函数的另外一个作用就是处理 stack 栈中剩余未被处理的标签。

    二、parseEndTag 函数的使用方式有三种：
      1、第一种是处理普通的结束标签，此时 三个参数都传递
      2、第二种是只传递第一个参数：
         parseEndTag(lastTag)
         只传递一个参数的情况我们前面遇到过，就是在 handleStartTag 函数中
      3、第三种是 不传递参数，当不传递参数的时候，就是我们讲过的，这是在处理 stack 栈剩余未处理的标签。
  */
  function parseEndTag (tagName, start, end) {
    /*变量 pos 会在后面用于判断 html 字符串是否缺少结束标签，lowerCasedTagName 变量用来存储 tagName 的小写版*/
    let pos, lowerCasedTagName
    /*
      当 start 和 end 不存在时，将这两个变量的值设置为当前字符流的读入位置，即 index。
      所以当我们看到这两个 if 语句时：parseEndTag 函数的第二个参数和第三个参数都是可选的，即不传。
    */
    if (start == null) start = index
    if (end == null) end = index
    /*如果存在 tagName 则将其转为小写并保存到之前定义的 lowerCasedTagName 变量中。*/
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    /* 寻找当前解析的结束标签所对应的开始标签在 stack 栈中的位置   
       一、pos 变量会被用来判断是否有元素缺少闭合标签
       二、<article><section><div></section></article>
           pos = 1,
           stack索引:0,1,2;stack 数组中存在索引大于 pos 的元素
       三、<article><section></div></section></article>
           对于 </div> 浏览器会将其忽略。所以 Vue 的 parser 与浏览器的行为是一致的。
           此时pos = -1
    */
    if (tagName) {
      /*遍历stack，就是遍历开始标签元素*/
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    }
    /* 如果 tagName 不存在，那么 pos 将始终等于 0 
       一、<article><section></section></article><div>
    */
    else {
      // If no tag name is provided, clean shop
      /*由于 pos 为 0，所以 i >= pos 始终成立，这个时候 stack 栈中如果有剩余未处理的标签，则会逐个警告缺少闭合标签，并调用 options.end 将其闭合。*/
      pos = 0
    }

    /*如果发现 stack 数组中存在索引大于 pos 的元素，那么该元素一定是缺少闭合标签的
      1.这个时候如果是在非生产环境那么 Vue 便会打印一句警告，告诉你缺少闭合标签。
      2.随后会调用 options.end(stack[i].tag, start, end) 立即将其闭合，这是为了保证解析结果的正确性。
    */
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
      /*最后更新 stack 栈以及 lastTag*/
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } 
    /*只写了结束br标签而没写开始br标签: </br> 会将其解析为正常的 <br> 标签*/
    else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    }
    /*只写了结束p标签而没写开始p标签: </p> 标签也会正常解析为 <p></p>*/
    else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
