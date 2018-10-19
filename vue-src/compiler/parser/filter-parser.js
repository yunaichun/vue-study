/* @flow */

/*该正则用来匹配一个字符，这个字符应该是字母、数字、)、.、+、-、_、$、] 之一*/
const validDivisionCharRE = /[\w).+\-_$\]]/

/*
  var str = '[';
  // 字符串对应数字编码
  str.charCodeAt(0) === 91
  // 数字编码对应字符串
  String.fromCharCode(91)
  String.fromCharCode(0x5b)
  // 十进制转为十六进制
  str.charCodeAt(0).toString(16) === '5b'
  // 十六进制转为十进制
  0x5b.toString(10) === '91'
*/
/**
 * [parseFilters 过滤器的解析]
 * @param  {[type]} exp: string        [动态绑定的值(v-bind或:)]
 * @return {[type]}                    [description]
 */
export function parseFilters (exp: string): string {
  /*inSingle 变量是用来标识当前读取的字符是否在由 单引号 包裹的字符串中。*/
  let inSingle = false
  /*inDouble 变量是用来标识当前读取的字符是否在由 双引号 包裹的字符串中。*/
  let inDouble = false
  /*inTemplateString 变量是用来标识当前读取的字符是否在 模板字符串 中。*/
  let inTemplateString = false
  /*inRegex 变量是用来标识当前读取的字符是否在 正则表达式 中。*/
  let inRegex = false
  /*在解析绑定的属性值时，每遇到一个左花括号({)，则 curly 变量的值就会加一，每遇到一个右花括号(})，则 curly 变量的值就会减一。*/
  let curly = 0
  /*在解析绑定的属性值时，每遇到一个左方括号([)，则 square 变量的值就会加一，每遇到一个右方括号(])，则 square 变量的值就会减一。*/
  let square = 0
  /*在解析绑定的属性值时，每遇到一个左圆括号(()，则 paren 变量的值就会加一，每遇到一个右圆括号())，则 paren 变量的值就会减一。*/
  let paren = 0
  /*lastFilterIndex 变量的初始值为 0，它的值是属性值字符串中字符的索引，将会被用来确定过滤器的位置*/
  let lastFilterIndex = 0
  /*
    变量 c 为当前字符对应的 ASCII 码；变量 prev 保存的则是当前字符的前一个字符所对应的 ASCII 码；
    变量 i 为当前读入字符的位置索引；变量 expression 将是 parseFilters 函数的返回值；
    变量 filters 将来会是一个数组，它保存着所有过滤器函数名。
  */
  let c, prev, i, expression, filters

  for (i = 0; i < exp.length; i++) {
    /*上一次读取的字符所对应的 ASCII 码赋值给 prev 变量*/
    prev = c
    /*将变量 c 的值设置为当前读取字符所对应的 ASCII 码*/
    c = exp.charCodeAt(i)

    /*单引号：<div :key="'id | featId'"></div>  <!-- 单引号内的管道符 --> */
    if (inSingle) {
      /*当前字符(')就应该是单引号字符串的结束，此时会将变量 inSingle 的值设置为 false，代表接下来的解析工作已经不处于单引号字符串环境中了。*/
      if (c === 0x27 && prev !== 0x5C) inSingle = false
    }
    /*双引号：<div :key='"id | featId"'></div>  <!-- 双引号内的管道符 -->*/
    else if (inDouble) {
      if (c === 0x22 && prev !== 0x5C) inDouble = false
    }
    /*模板字符串：<div :key="`id | featId`"></div>  <!-- 模板字符串内的管道符 -->*/
    else if (inTemplateString) {
      if (c === 0x60 && prev !== 0x5C) inTemplateString = false
    }
    /* 正则：<div :key="/id|featId/.test(id).toString()"></div>  <!-- 正则表达式内的管道符 -->*/
    else if (inRegex) { 
       /* 识别一个斜杠它所代表的意义到底是除法还是正则：
          1、实际上这是一个相当复杂的事情，引用 ECMA 规范 中的一段例子：
             a = b
             /hi/g.exec(c).map(d)
             大家思考一个问题，上面代码段中第二句代码开头的斜杠(/)是除法运算符还是正则表达式的开头？答案是除法，因为如上代码等价于：
             a = b / hi / g.exec(c).map(d)
          2、除此之外再来看一个例子：
             // 第一段代码
             function f() {}
             /1/g

             // 第二段代码
             var a = {}
             /1/g

          3、如上两段代码所示，这两段代码具有相同的特点，即第一句代码的最后一个字符为 }，第二句代码的第一个字符为 /。
             第一段代码中的斜杠是正则：因为该斜杠之前的语境是函数定义。
             第二段代码中的斜杠是除法：因为该斜杠之前的语境为表达式并且花括号({})的意义为对象字面量。

          4、判断一个斜杠到底代表什么意义，应该综合考虑上下文语境，ECMA 规范中 中清楚的已经告诉大家需要多种标志符号类型(goal symbols)来综合判断，
             并且还要考虑 javascript 这门语言的自动插入分号机制，以及其他可能产生歧义的地方。

             如果要实现一个完整的能够精确识别斜杠意义的解析器需要花费大量的精力并且编写大量的代码，
             但对于 Vue 来讲，去实现一个完整的解析器是一个收入与回报完全不对等的事情。
             parseFilters 函数对于正则的处理仅仅考虑了很小的一部分，但对于 Vue 来说，这已经足够了。
             还是那句话：为什么一定要在绑定的表达式中写正则呢？用计算属性就可以了啊！！！！！！！
      */
      if (c === 0x2f && prev !== 0x5C) inRegex = false
    }
    /* 被当做管道符 | 处理：
    1、当前字符所对应的 ASCII 码必须是 0x7C，即当前字符必须是管道符。
    2、该字符的后一个字符不能是管道符。
    3、该字符的前一个字符不能是管道符。
    4、该字符不能处于花括号、方括号、圆括号之内
    */
    else if (
      c === 0x7C && // pipe
      exp.charCodeAt(i + 1) !== 0x7C &&
      exp.charCodeAt(i - 1) !== 0x7C &&
      !curly && !square && !paren
    ) {
      /*解析到第一个管道符：将表达式存储在expression变量中*/
      if (expression === undefined) {
        // first filter, end of expression
        /*i + 1是管道符下一个字符的位置索引，所以我们可以把 lastFilterIndex 变量理解为过滤器的开始*/
        lastFilterIndex = i + 1
        /*截取管道符之前的字符：expression 变量中保存着过滤器分界线之前的字符串，也就是表达式*/
        expression = exp.slice(0, i).trim()
      }
      /*解析到第一个之后的管道符：将过滤器存储在filters数组中*/
      else {
        pushFilter()
      }
    }
    /*进入以下9中环境：字符串内的字符都将被跳过；目的就是为了避免误把存在于字符串中的管道符当做过滤器的分界线(以上条件)
      假设我们有如下代码：
      <div :key="'id'"></div>
      此时传递给 parseFilters 函数的字符串就应该是 'id' ，该字符串有四个字符。
      1、首先读取该字符串的第一个字符，即单引号 ' ，
      2、接着会判断 inSingle 变量是否为真，由于 inSingle 变量的初始值为 false，所以会继续判断下一个条件分支；
      3、同样的由于 inDouble、inTemplateString、inRegex 等变量的初始值都为 false，并且该字符是单引号而不是管道符；
      4、所以接下来的任何一个 elseif 分支语句块内的代码都不会被执行。所以最终 else 语句块内的代码将被执行。
    */
    else {
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }
      /*判断进入正则环境*/
      if (c === 0x2f) { // /
        let j = i - 1
        let p
        // find first non-whitespace prev char
        /*for 循环的作用：
          1、找到 / 字符之前第一个不为空的字符。
          2、如果没找到则说明字符 / 之前的所有字符都是空格，或根本就没有字符，如下：
             <div :key="/a/.test('abc')"></div>      <!-- 第一个 `/` 之前就没有字符  -->
             <div :key="    /a/.test('abc')"></div>  <!-- 第一个 `/` 之前都是空格  -->
        */
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        /* 判断条件：
        1、/ 为空或者无字符；
        2、/ 前有字符，但是字符不为字母、数字、)、.、+、-、_、$、] 之一
        */
        if (!p || !validDivisionCharRE.test(p)) {
          /*反例如下：
          1、<div :key="a + /a/.test('abc')"></div>  
             实际上在表达式 a + /a/.test('abc') 中出现的斜杠(/)的确是定义了正则，
             但 Vue 却不认为它是正则，因为第一个斜杠之前的第一个不为空的字符为加号 +。
          2、加号存在于正则 validDivisionCharRE 中，所以 Vue 不认为这里的斜杠是正则的定义。
             但实际上如上代码简直就是没有任何意义的，假如你非得这么写，那你也完全可以使用计算属性替代。
          */
          inRegex = true
        }
      }
    }
  }

  /*当所有字符都已经解析完毕：没有遇到管道符，需要将表达式提取出来*/
  if (expression === undefined) {
    expression = exp.slice(0, i).trim()
  }
  /*当所有字符都已经解析完毕：需要将最后一个过滤器提取出来*/
  else if (lastFilterIndex !== 0) {
    pushFilter()
  }

  /*处理管道符 | 之后的过滤器内容*/
  function pushFilter () {
    /*首先检查变量 filters 是否存在，如果不存在则将其初始化为空数组，接着使用 slice 方法对字符串 exp 进行截取*/
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    /*可能存在下一个管道符*/
    lastFilterIndex = i + 1
  }

  /*存在过滤器*/
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      expression = wrapFilter(expression, filters[i])
    }
  }

  return expression
}

/**
 * [wrapFilter 将过滤器包装在表达式上]
 * @param  {[type]} exp:    string        [表达式]
 * @param  {[type]} filter: string        [过滤器名称]
 * @return {[type]}                       [返回包装后的表达式]
 */
function wrapFilter (exp: string, filter: string): string {
  /*过滤器是否有左圆括号，过滤器可以为函数*/
  const i = filter.indexOf('(')
  /*过滤器不为函数*/
  if (i < 0) {
    // _f: resolveFilter
    return `_f("${filter}")(${exp})`
  }
  /*过滤器为函数*/
  else {
    /*过滤器函数名*/
    const name = filter.slice(0, i)
    /*过滤器函数参数*/
    const args = filter.slice(i + 1)
    return `_f("${name}")(${exp},${args}`
  }
}
