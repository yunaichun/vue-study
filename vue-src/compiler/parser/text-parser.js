/* @flow */

import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

/*用来惰性匹配 {{}} 里的内容，并捕获 {{}} 里的内容
  在使用 Vue 的时候可以通过 delimiters 选项自定义字面量表达式的分隔符，比如可以将其配置成 delimiters: ['${', '}']，
  正是由于这个原因，所以不能一味的使用 defaultTagRE 正则去识别字面量表达式，
  我们需要根据开发者对 delimiters 选项的配置自动生成一个新的正则表达式，并用其匹配文本。
*/
const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g
/*
可以看到该正则所匹配的字符都是那些在正则表达式中具有特殊意义的字符，正是因为这些字符在正则表达式中具有特殊意义，
所以才需要使用 replace 方法将匹配到的具有特殊意义的字符进行转义，转义的结果就是在具有特殊意义的字符前面添加字符 \，
所以最终 open 常量的值将为：'\$\{'。
*/
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

/*该函数接收 delimiters 选项的值作为参数，并返回一个新的正则表达式 
  一、最终 buildRegex 函数将会构建一个全新的正则：
      new RegExp(open + '((?:.|\\n)+?)' + close, 'g')

  二、等价于：
      new RegExp('\$\{((?:.|\\n)+?)\}', 'g')

  三、也就等价于：
      /\$\{((?:.|\\n)+?)\}/g
      如上正则与 defaultTagRE 正则相比，仅仅是分隔符部分发生了变换。
*/
const buildRegex = cached(delimiters => {
  /* 以 open 常量为例讲解该常量的值，如下：
    一、假如开发者指定 delimiters 选项的值为 ['${', '}']，
        open相当于：${'.replace(regexEscapeRE, '\\$&')

    二、字符串的 replace 方法的第二个参数可以是一个字符串，即要替换的文本，如果第二个参数是字符串，则可以使用特殊的字符序列：
        $$ =====> $
        $& =====> 匹配整个模式的字符串，与RegExp.lastMatch的值相同
        $' =====> 匹配的子字符串之后的子字符串，与RegExp.rightContext的值相同
        $` =====> 匹配的子字符串之前的子字符串，与RegExp.leftContext的值相同
        $n =====> 匹配第n(0 ~ 9)个捕获组的子字符串，如果正则表达式中没有捕获组，则使用空字符串
        $nn =====> 匹配第nn(01 ~ 99)个捕获组的子字符串，如果正则表达式中没有捕获组，则使用空字符串
  */
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  /*新的正则使用 open 和 close 常量的内容替换掉用了默认的 {{}}*/
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

/**
 * [parseText 解析文本节点字面量表达式]
 * @param  {[type]} text:        [String]         [文本节点内容]
 * @param  {[type]} delimiters?: [Boolean]        [options中的配置项]
 * @return {[type]}              [String]         ["text"+_s(name)]
 */
export function parseText (
  text: string,
  delimiters?: [string, string]
): string | void {
  /*如果 delimiters 选项存在则使用 buildRegex 函数构建的新正则去匹配文本，否则使用默认的 defaultTagRE 正则*/
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  /*文本节点中不含有字面量表达式，直接返回*/
  if (!tagRE.test(text)) {
    return
  }

  const tokens = []
  let lastIndex = tagRE.lastIndex = 0
  let match, index
  /* tagRE 正则匹配文本内容，并将匹配结果保存在 match 变量中，直到匹配失败循环才会终止，这时意味着所有的字面量表达式都已经处理完毕了*/
  while ((match = tagRE.exec(text))) {
    /*该属性的值代表匹配的字符串在整个字符串中的位置，假设我们有这样一段文本：'abc{{name | someFilter}}def'，则匹配成功后 match.index 的值为 3，因为第一个左花括号({)在整个字符串中的索引是 3。*/
    index = match.index
    // push text token
    /* 存在普通文本：
      一、判断了变量 index 的值是否大于 lastIndex 变量的值，什么情况下会出现变量 index 的值大于 lastIndex 变量的值的情况？
          lastIndex 变量的初始值是 0，所以只要 index 变量大于 0 即可，换句话说只要 match.index 变量的值大于 0 即可。

      二、还是以这段文本为例：'abc'，我们知道当匹配这段文本时，match.index 的值将会为 3，它大于 0，
          所以此时如上 if 条件语句的判断条件满足，此时将会执行 if 语句块内的代码
    */
    if (index > lastIndex) {
      /* 保存普通文本：
        text.slice(lastIndex, index)这句代码使用字符串的 slice 方法对文本进行截取，
        假如我们还拿上例来说，则如上这句代码相当于：'abc{{name}}'.slice(0, 3)
      */
      tokens.push(JSON.stringify(text.slice(lastIndex, index)))
    }

    // tag token
    /* 字面量表达式中的过滤器：
      一、设文本内容为 'abc{{name | someFilter}}def'，则 match[1] 的值为字符串 'name | someFilter'，
          所以const exp = parseFilters(match[1].trim()) 
          等价于const exp = parseFilters('name | someFilter')

      二、parseFilters 函数的作用：最终 exp 常量的值为字符串 "_f('someFilter')(name)"
    */
    const exp = parseFilters(match[1].trim())
    /* 此时token数组：tokens = ["'abc'", '_s(_f("someFilter")(name))'] */
    tokens.push(`_s(${exp})`)
    /*lastIndex 变量的值等于 index 变量的值加上匹配的字符串的长度：将指针指向此次匹配到的字面量结束位置*/
    lastIndex = index + match[0].length
  }
  /*目的是为了截取剩余的普通文本并将其添加到 tokens 数组中*/
  if (lastIndex < text.length) {
    // tokens = ["'abc'", '_s(_f("someFilter")(name))', "'def'"]
    tokens.push(JSON.stringify(text.slice(lastIndex)))
  }
  /*将数组转为字符串："'abc'+_s(_f("someFilter")(name))+'def'",*/
  return tokens.join('+')
}
