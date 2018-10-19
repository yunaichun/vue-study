/* @flow */

/**
 * Cross-platform code generation for component v-model
 */
export function genComponentModel (
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
): ?boolean {
  const { number, trim } = modifiers || {}

  const baseValueExpression = '$$v'
  let valueExpression = baseValueExpression
  if (trim) {
    valueExpression =
      `(typeof ${baseValueExpression} === 'string'` +
        `? ${baseValueExpression}.trim()` +
        `: ${baseValueExpression})`
  }
  if (number) {
    valueExpression = `_n(${valueExpression})`
  }
  const assignment = genAssignmentCode(value, valueExpression)

  el.model = {
    value: `(${value})`,
    expression: `"${value}"`,
    callback: `function (${baseValueExpression}) {${assignment}}`
  }
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
/**
 * [genAssignmentCode 生成一个代码字符串]
 * @param  {[type]} value:      string        [元素绑定属性值]
 * @param  {[type]} assignment: string        [自定义字符串的值]
 * @return {[type]}                           [作用就是一个赋值工作。这样就免去了我们手动赋值的繁琐]
 */
export function genAssignmentCode (
  value: string,
  assignment: string
): string {
  /*解析元素绑定属性值*/
  const res = parseModel(value)
  /*如果元素绑定属性值没有单引号、双引号、'['、最后一个字符不是']'*/
  if (res.key === null) {
    return `${value}=${assignment}`
  } else {
    return `$set(${res.exp}, ${res.key}, ${assignment})`
  }
}


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
 * Parse a v-model expression into a base path and a final key segment.
 * Handles both dot-path and possible square brackets.
 *
 * Possible cases:
 *
 * - test
 * - test[key]
 * - test[test1[key]]
 * - test["a"][key]
 * - xxx.test[a[a].test1[key]]
 * - test.xxx.a["asa"][test1[key]]
 *
 */
/**
 * @variable  {[type]} len:                   number        [绑定属性值val的长度]
 * @variable  {[type]} str:                   string        [绑定属性值val]
 * @variable  {[type]} index:                 string        [绑定属性值val当前位置索引]
 * @variable  {[type]} chr:                   number        [绑定属性值val当前位置索引对应的charCodeAt值]
 * @variable  {[type]} expressionPos:         number        [存储第一次解析到'['字符时的index]
 * @variable  {[type]} expressionEndPos:      number        [存储'['与']'数量一致时当前的index]
 */
let len, str, chr, index, expressionPos, expressionEndPos
type ModelParseResult = {
  exp: string,
  key: string | null
}
/**
 * [parseModel 解析元素绑定属性值]
 * @param  {[type]} val: string        [元素绑定属性值]
 * @return {[type]}                    [返回解析后的元素绑定的属性值]
 */
export function parseModel (val: string): ModelParseResult {
  /*元素绑定属性值的长度*/
  len = val.length
  /*元素绑定属性值不含有'['、或者最后一位不是']'*/
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    /*元素绑定属性值最后一个'.'的位置索引*/
    index = val.lastIndexOf('.')
    if (index > -1) {
      return {
        exp: val.slice(0, index), /*截取到'.'之前的位置(不包含'.')*/
        key: '"' + val.slice(index + 1) + '"' /*截取'.'之后的位置(不包含'.')*/
      }
    } else {
      return {
        exp: val,
        key: null
      }
    }
  }


  str = val
  index = expressionPos = expressionEndPos = 0

  /*绑定属性值val当前位置索引不在最后一位*/
  while (!eof()) {
    /*绑定属性值val当前位置索引index下一位的字符编码*/
    chr = next()
    /* istanbul ignore if */
    /*下一位的字符编码是双引号或者单引号*/
    if (isStringStart(chr)) {
      parseString(chr)
    }
    /*下一位的字符编码是'['*/
    else if (chr === 0x5B) {
      parseBracket(chr)
    }
  }

  return {
    exp: val.slice(0, expressionPos), /*截取到第一次解析到'['字符之前的位置(不包含'[')*/
    key: val.slice(expressionPos + 1, expressionEndPos) /*截取'['之后的位置(不包含'[') */
  }
}

/**
 * [next 绑定属性值val当前位置索引index下一位的字符编码]
 * @return {Boolean}                    [返回下一位的字符编码值]
 */
function next (): number {
  return str.charCodeAt(++index)
}

/**
 * [eof 绑定属性值val当前位置索引在最后一位时]
 * @return {Boolean}                    [返回是否是最后一位索引]
 */
function eof (): boolean {
  return index >= len
}

/**
 * [isStringStart 判断字符编码是否是双引号或者单引号]
 * @param  {[type]}  chr: number        [字符编码]
 * @return {Boolean}                    [返回此字符编码是否是双引号或者单引号]
 */
function isStringStart (chr: number): boolean {
  return chr === 0x22 || chr === 0x27
}

/**
 * [parseString 解析双引号或者单引号之后的字符]
 * @param  {[type]} chr: number        [当前位置索引index下一位的字符编码]
 * @return {[type]}                    [没有返回，更改了cha和index的值]
 */
function parseString (chr: number): void {
  /*保存下一位编码的值：为双引号或者单引号*/
  const stringQuote = chr
  /*遍历后续字符串，直到找到和stringQuote相同的字符为止*/
  while (!eof()) {
    /*绑定属性值下一位的字符编码*/
    chr = next()
    /*绑定属性值下一位的字符编码与stringQuote值相同*/
    if (chr === stringQuote) {
      break
    }
  }
}

/**
 * [parseBracket 解析'['字符之后的字符]
 * @param  {[type]} chr: number        [当前位置索引index下一位的字符编码]
 * @return {[type]}                    [description]
 */
function parseBracket (chr: number): void {
  /*因为cha为'['，所以初始inBracket为1*/
  let inBracket = 1
  /*expressionPos存储第一次解析到'['字符时的index*/
  expressionPos = index
  /*遍历后续字符串，直到inBracket等于0为止，即'['与']'数量一致*/
  while (!eof()) {
    /*绑定属性值下一位的字符编码*/
    chr = next()
    /*绑定属性值下一位的字符编码是双引号或者单引号*/
    if (isStringStart(chr)) {
      /*解析双引号或者单引号之后的字符*/
      parseString(chr)
      /*解析双引号和单引号之后跳到下一个循环*/
      continue
    }
    /*绑定属性值下一位的字符编码为'['，inBracket加1*/
    if (chr === 0x5B) inBracket++
    /*绑定属性值下一位的字符编码为']'，inBracket减1*/
    if (chr === 0x5D) inBracket--
    /*如果'['与']'数量一致*/
    if (inBracket === 0) {
      /*存储'['与']'数量一致时当前的index*/
      expressionEndPos = index
      break
    }
  }
}


