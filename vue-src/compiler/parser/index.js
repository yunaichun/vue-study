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
      1、第一个分组为 (.*?)。该分组是一个惰性匹配的分组：.* 代表除换行符之外任意字符.(http://www.cnblogs.com/hehexu/p/9198296.html)
      2、第二个分组为 (?:in|of)。该分组是一个非捕获的分组：该分组用来匹配字符串 in 或者 of.(https://www.jianshu.com/p/5150863e7f7a)
      3、第三个分组为 (.*)。该分组是一个非惰性匹配的分组：.* 代表除换行符之外任意字符.
  
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
  /* 当前元素的父级元素，element为当前元素
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
    /* 
      总结下 start 钩子函数的内容：
      1、start 钩子函数是当解析 html 字符串遇到开始标签时被调用的。
      2、模板中禁止使用 <style> 标签和那些没有指定 type 属性或 type 属性值为 text/javascript 的 <script> 标签。
      3、在 start 钩子函数中会调用前置处理函数，这些前置处理函数都放在 preTransforms 数组中，这么做的目的是为不同平台提供对应平台下的解析工作。
      4、前置处理函数执行完之后会调用一系列 process* 函数继续对元素描述对象进行加工。
      5、通过判断 root 是否存在来判断当前解析的元素是否为根元素。
      6、slot 标签和 template 标签不能作为根元素，并且根元素不能使用 v-for 指令。
      7、可以定义多个根元素，但必须使用 v-if、v-else-if 以及 v-else 保证有且仅有一个根元素被渲染。
      8、构建 AST 并建立父子级关系是在 start 钩子函数中完成的，每当遇到非一元标签，会把它存到 currentParent 变量中，当解析该标签的子节点时通过访问 currentParent 变量获取父级元素。
      9、如果一个元素使用了 v-else-if 或 v-else 指令，则该元素不会作为子节点，而是会被添加到相符的使用了 v-if 指令的元素描述对象的 ifConditions 数组中。
      10、如果一个元素使用了 slot-scope 特性，则该元素也不会作为子节点，它会被添加到父级元素描述对象的 scopedSlots 属性中。
      11、对于没有使用条件指令或 slot-scope 特性的元素，会正常建立父子级关系。
    */
    /**
     * [start 在解析 html 字符串时每次遇到 开始标签 时就会调用该函数]
     * @param  {[type]} tag   [标签名字 tag，该，以及代表着该标签是否是一元标签的标识 unary]
     * @param  {[type]} attrs [标签的属性数组 attrs]
     * @param  {[type]} unary [标签是否是一元标签的标识 unary]
     * @return {[type]}       [description]
     */
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      /* 命名空间：只有svg和math标签存在
        一、ns 常量，它的值为标签的命名空间；currentParent 变量为当前元素的父级元素描述对象，
        二、如果当前元素存在父级并且父级元素存在命名空间，则使用父级的命名空间作为当前元素的命名空间。
            如果父级元素不存在或父级元素没有命名空间，那么会通过调用 platformGetTagNamespace(tag) 函数获取当前元素的命名空间。
       
        三、举个例子，假设我们解析的模板字符串为：
            <svg width="100%" height="100%" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="20" width="250" height="250" style="fill:blue;"/>
            </svg>
            如上是用来画一个蓝色矩形的 svg 代码，其中我们使用了两个标签：svg 标签和 rect 标签，
            当解析如上代码时首先会遇到 svg 标签的开始标签，由于 svg 标签没有父级元素，
            所以会通过 platformGetTagNamespace(tag) 获取 svg 标签的命名空间，最终得到 svg 字符串：
            platformGetTagNamespace('svg')  // 'svg'

            下一个遇到的开始标签则是 rect 标签的开始标签，由于 rect 标签存在父级元素(svg 标签)，
            所以此时 rect 标签会使用它父级元素的命名空间作为自己的命名空间。

        四、platformGetTagNamespace 函数只会获取 svg 和 math 这两个标签的命名空间，
            但这两个标签的所有子标签都会继承它们两个的命名空间。对于其他标签则不存在命名空间。
      */
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      /* IE11渲染svg标签渲染的怪异现象
        一、IE 11 的bug：该问题是 svg 标签中渲染多余的属性，如下 svg 标签：
            <svg xmlns:feature="http://www.openplans.org/topp"></svg>
            被渲染为：
            <svg  xmlns:NS1=""  NS1:xmlns:feature="http://www.openplans.org/topp"></svg>
        二、标签中多了 'xmlns:NS1="" NS1:' 这段字符串，解决办法也很简单，将整个多余的字符串去掉即可。
      */ 
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      /* 当前节点元素对象 (currentParent为当前元素的父级元素)
        一、为当前元素创建了描述对象，当前标签的元素描述对象赋值给 element 变量。
            紧接着检查当前元素是否存在命名空间 ns，如果存在则在元素对象上添加 ns 属性，其值为命名空间的值。

        三、如果当前解析的开始标签为 svg 标签或者 math 标签或者它们两个的子节点标签，
            都将会比其他 html 标签的元素描述对象多出一个 ns 属性，且该属性标识了该标签的命名空间。
      */
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }

      /* Vue模板中禁用script和style标签
        一、非服务端渲染情况下，当前元素是否是禁止在模板中使用的标签。
            什么是被禁止的标签呢？<style> 标签和 <script> 都被认为是禁止的标签，
            因为 Vue 认为模板应该只负责做数据状态到 UI 的映射，而不应该存在引起副作用的代码，
            如果模板中存在 <script> 标签，那么该标签内的代码很容易引起副作用。

        二、但有一种情况例外，比如其中一种定义模板的方式为：
            <script type="text/x-template" id="hello-world-template">
              <p>Hello hello hello</p>
            </script>
            把模板放到 <script> 元素中，并在 <script> 元素上添加 type="text/x-template" 属性。
            可以看到 Vue 并非禁止了所有的 <script> 元素，这在 isForbiddenTag 函数中是有体现的
      */
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }


      /* preTransforms 数组中的函数的作用：
         本质上这些函数的作用与我们之前见到过的process*系列的函数相似，都是对当前元素描述对象做进一步处理。
      */
      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }
      /*处理使用了v-pre指令的元素及其子元素*/
      if (!inVPre) {     
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        /* latformIsPreTag 函数判断当前元素是否是 <pre> 标签
           <pre> 标签内的解析行为与其他 html 标签是不同。具体不同体现在：
           1、<pre> 标签会对其所包含的 html 字符实体进行解码
           2、<pre> 标签会保留 html 字符串编写时的空白
        */
        inPre = true
      }
      /* 当前解析环境是在 v-pre 环境下:
         编译器会跳过使用了 v-pre 指令元素及其子元素的编译工作
      */
      if (inVPre) {
        processRawAttrs(element)
      } 
      /* 当前元素的解析没有处于 v-pre 环境：
         会调用一系列 process* 函数来处理该元素的描述对象
      */
      else if (!element.processed) {
        // structural directives
        processFor(element)
        processIf(element)
        processOnce(element)
        // element-scope stuff
        processElement(element, options)
      }


      /**
       * [checkRootConstraints 模板根元素要求：模板必须有且仅有一个被渲染的根元素]
       * @param  {[type]} el [当前元素]
       * @return {[type]}    [description]
       */
      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          /*  不能使用 slot 标签和 template 标签作为模板的根元素，原因是：
              1、这是因为 slot 作为插槽，它的内容是由外界决定的，而插槽的内容很有可能渲染多个节点，
              2、template 元素的内容虽然不是由外界决定的，但它本身作为抽象组件是不会渲染任何内容到页面的，
                 而其又可能包含多个子节点，所以也不允许使用 template 标签作为根节点。
          */
          if (el.tag === 'slot' || el.tag === 'template') {
            /*打印警告信息时使用的是 warnOnce 函数而非 warn 函数，
              如果第一个 warnOnce 函数执行并打印了警告信息那么第二个 warnOnce 函数就不会再次打印警告信息，
              目的是每次只提示一个编译错误给用户，避免多次打印不同错误给用户造成迷惑，这是出于对开发者解决问题友好的考虑。
            */
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          /* v-for 指令会渲染多个节点所以根元素是不允许使用 v-for 指令的
          */
          if (el.attrsMap.hasOwnProperty('v-for')) {
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }
      // tree management
      /* 如果根元素不存在：将当前元素(element)赋值给根元素(root)*/
      if (!root) {
        root = element
        checkRootConstraints(root)
      } 
      /* 模板中存在多个根元素：分为合理和不合理两种情况
        一、每当遇到一个非一元标签时就会将该标签的描述对象放进stack，
            并且每当遇到一个结束标签时都会将该标签的描述对象从 stack 数组中拿掉；
        二、也就是说在只有一个根元素的情况下，正常解析完成一段 html 代码后 stack 数组应该为空，
            或者换个说法，即当 stack 数组被清空后则说明整个模板字符串已经解析完毕了；
        三、但此时 start 钩子函数仍然被调用了，这说明模板中存在多个根元素。
      */
      else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        /* 模板中存在多个合理的根元素
          一、元素对象中的.if属性.elseif属性以及.else属性来自processIf函数的处理，
              如果元素的属性中有v-if或v-else-if或v-else，则会在元素描述对象上添加相应的属性作为标识。
          二、root为当根元素描述对象，root.if指的是根元素含有v-if执行
              element为当前元素描述对象，即非第一个根元素的描述对象
        */
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          addIfCondition(root, {   /* root参数为第一个根元素描述对象 */
            exp: element.elseif,   /* exp 为当前元素描述对象的 element.elseif 的值 */
            block: element         /* block 是当前元素描述对象 */
          })
        }
        /* 模板中存在多个不合理的根元素 */
        else if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }


      /* 当前元素存在父级：正确引用父子级关系 */
      if (currentParent && !element.forbidden) {
        /* 当前元素存在v-else-if或v-else指令：
           1、该元素不会作为一个独立的子节点
           2、该元素会被添加到前一个兄弟v-if元素描述对象的ifConditions数组中
        */
        if (element.elseif || element.else) {
          processIfConditions(element, currentParent)
        }
        /* 当前元素使用了slot-scope特性：
           1、该元素不会作为一个独立的子节点
           2、该元素的描述对象会被添加到父级元素描述对象的scopedSlots对象下
        */
        else if (element.slotScope) { // scoped slot
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        }
        /*  建立元素描述对象间的父子级关系：！！！！！！！！！！！！
            1、把当前元素描述对象添加到父级元素描述对象的 children 数组中，
            2、同时将当前元素对象的 parent 属性指向父级元素对象，
          */
        else {
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }


      /* 当前元素是非一元标签：正确引用当前元素的父级 */
      if (!unary) {
        /* currentParent指向当前元素的父级 */
        currentParent = element
        /* stack的作用是指向正确的父级
          一、将当前元素描述对象添加到stack数组，stack栈顶的元素始终存储的是currentParent的值，即当前解析元素的父级
          二、目的是在end钩子函数中每当遇到一个非一元标签的结束标签时，
              都会回退 currentParent 变量的值为之前的值，将stack数组从栈顶取出来一个，这样我们就修正了当前正在解析的元素的父级元素。
        */
        stack.push(element)
      }
      /* 当前元素是一元标签：闭合标签*/
      else {
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

/*
  一、ieNSBug 正则用来匹配那些以字符串 xmlns:NS 再加一个或多个数字组成的字符串开头的属性名，如：
      <svg xmlns:NS1=""></svg>
  二、如上标签的 xmlns:NS1 属性将会被 ieNSBug 正则匹配成功。
*/
const ieNSBug = /^xmlns:NS\d+/
/*
  一、ieNSPrefix来匹配那些以字符串 NS 再加一个或多个数字以及字符 : 所组成的字符串开头的属性名，如：
      <svg NS1:xmlns:feature="http://www.openplans.org/topp"></svg>
  二、如上标签的 NS1:xmlns:feature 属性将被 ieNSPrefix 正则匹配成功。
*/
const ieNSPrefix = /^NS\d+:/
/* istanbul ignore next */
/**
 * [guardIESVGBug  IE11的bug：svg标签会渲染出多余的属性]
 * @param  {[type]} attrs [词法解析出的属性]
 * @return {[type]}       [description]
 */
function guardIESVGBug (attrs) {
  /*
    一、IE 11 的bug：该问题是 svg 标签中渲染多余的属性，如下 svg 标签：
        <svg xmlns:feature="http://www.openplans.org/topp"></svg>
        被渲染为：
        <svg  xmlns:NS1=""  NS1:xmlns:feature="http://www.openplans.org/topp"></svg>

    二、在解析如上标签时，传递给 start 钩子函数的标签属性数组 attrs 为：
        attrs = [
          {
            name: 'xmlns:NS1',
            value: ''
          },
          {
            name: 'NS1:xmlns:feature',
            value: 'http://www.openplans.org/topp'
          }
        ]
    三、在经过 guardIESVGBug 函数处理之后，属性数组中的第一项因为属性名满足 ieNSBug 正则被剔除，
        第二项属性名字 NS1:xmlns:feature 将被变为 xmlns:feature，所以 guardIESVGBug 返回的属性数组为：
        attrs = [
          {
            name: 'xmlns:feature',
            value: 'http://www.openplans.org/topp'
          }
        ]

  */
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

/**
 * [isForbiddenTag vue模板中禁用的标签]
 * @param  {[type]}  el [当前元素]
 * @return {Boolean}    [description]
 */
function isForbiddenTag (el): boolean {
  /*1、没有指定 type 属性；2、虽然指定了 type 属性但其值为 text/javascript 的 <script> 标签被认为是被禁止的
    <script type="text/x-template" id="hello-world-template">
      <p>Hello hello hello</p>
    </script>
  */
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

/**
 * [addIfCondition 将有v-else-if或v-else指令的元素对象添加到v-if指令的元素对象的ifConnditions属性中]
 * @param {[type]} el:        ASTElement     [if元素：具有v-if指令的元素对象(root)]
 * @param {[type]} condition: ASTIfCondition [else元素：具有v-else和v-else-if指令的元素对象  { exp: element.elseif, block: element } ]
 */
export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  /* 如果根元素描述对象没有el.ifConditions属性，则创建该属性同时初始化为空数组 */
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  /* 具有v-else-if或v-else属性的元素的描述对象会被添加到具有v-if属性的元素描述对象的.ifConnditions数组中
      1、举个例子，如下模板：
        <div v-if="a"></div>
        <p v-else-if="b"></p>
        <span v-else></span>
      2、解析后生成的 AST 如下(简化版)：
        {
          type: 1,
          tag: 'div',
          ifConditions: [
            {
              exp: 'b',
              block: { type: 1, tag: 'p', ……} // block 是当前元素描述对象
            },
            {
              exp: undefined,
              block: { type: 1, tag: 'span', …… } // block 是当前元素描述对象
            }
          ]
          // 省略其他属性...
        }
      3、其实如上描述是不准确的，后面我们会发现带有 v-if 属性的元素也会将自身的元素描述对象添加到自身的 .ifConditions 数组中，即：
        {
          type: 1,
          tag: 'div',
          ifConditions: [
            {
              exp: 'a',
              block: { type: 1, tag: 'div', …… } // block 是当前元素描述对象
            },
            {
              exp: 'b',
              block: { type: 1, tag: 'p', …… } // block 是当前元素描述对象
            },
            {
              exp: undefined,
              block: { type: 1, tag: 'span', …… } // block 是当前元素描述对象
            }
          ]
          // 省略其他属性...
        }
  */
  el.ifConditions.push(condition)
}

/**
 * [processIfConditions 将有v-else-if或v-else指令的元素对象添加到v-if指令的元素对象的ifConditions属性中]
 * @param  {[type]} el     [else元素：具有v-else-if或v-else指令]
 * @param  {[type]} parent [父级元素：通过父级元素可以查询到else的前一个if兄弟元素]
 * @return {[type]}        [description]
 */
function processIfConditions (el, parent) {
  /* 找到else元素的前一个if元素 */
  const prev = findPrevElement(parent.children)
  /* 当前元素的前一个元素使用了 v-if 指令:
     调用addIfCondition函数将当前元素描述对象添加到前一个元素的ifConditions数组中
  */
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  }
  /* 当前元素的前一个元素没有使用 v-if 指令:
     Vue报错警告
  */
  else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}

/**
 * [findPrevElement 当解析器遇到一个带有v-else-if或v-else指令的元素时，找到该元素的前一个元素节点]
 * @param  {[type]} children: Array<any>    [元素描述对象，层级相同的子节点]
 * @return {[type]}                         [description]
 */
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  /* 要想得到 v-if 标签：只要找到父对象的 children 数组最后一个元素节点
    一、假设我们解析如下 html 字符串：
        <div>
          <div v-if="a"></div>
          <p v-else-if="b"></p>
          <span v-else="c"></span>
        </div>

    二、解析v-else-if指令的p标签：
        由于当前正在解析的标签为 p，此时 p 对象还没有被添加到父对象的 children 数组中，
        所以此时父级元素描述对象的 children 数组中最后一个元素节点就应该是 div 元素。
        所以要想得到 div 标签，只要找到父对象的 children 数组最后一个元素节点即可。

    三、解析v-else指令的span标签：
        当解析器遇到带有 v-else 指令的 span 标签时，此时 span 标签的前一个元素节点还是 div 标签，而不是 p 标签，
        这是因为 p 元素没有被添加到父对象的 children 数组中，而是被添加到 div 元素的ifConditions数组中了。
        所以对于 span 标签来讲，它的前一个元素节点仍然是 div 标签。
  */
  while (i--) {
    /* 元素节点：返回父对象的 children 数组最后一个元素节点 */
    if (children[i].type === 1) {
      return children[i]
    }
    /* 文本节点：文本节点被从 children 数组中 pop 出去 */
    else {
      /*  举个例子：
            <div>
              <div v-if="a"></div>
              aaaaa
              <p v-else-if="b"></p>
              bbbbb
              <span v-else="c"></span>
            </div>
          如上代码中的文本 aaaaa 和 bbbbb 都将被忽略。
      */
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


/**
 * [processPre 处理使用了v-pre指令的元素及其子元素]
 * @param  {[type]} el [元素的描述对象]
 * @return {[type]}    [如果有 v-pre 属性则会在 el 描述对象上添加一个 pre 属性]
 */
function processPre (el) {
  /*获取给定元素的 v-pre 属性的值*/
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

/*  对使用了 v-pre 指令的标签所生成的元素描述对象做一个总结：
    1、如果标签使用了 v-pre 指令，则该标签的元素描述对象的 element.pre 属性将为 true。
    2、对于使用了 v-pre 指令的标签及其子代标签，它们的任何属性都将会被作为原始属性处理，即使用 processRawAttrs 函数处理之。
    3、经过 processRawAttrs 函数的处理，会在元素的描述对象上添加 element.attrs 属性，
       它与 element.attrsList 数组结构相同，不同的是 element.attrs 数组中每个对象的 value 值会经过 JSON.stringify 函数处理。
    4、如果一个标签没有任何属性，并且该标签是使用了 v-pre 指令标签的子代标签，那么该标签的元素描述对象将被添加 element.plain 属性，并且其值为 true。
*/
/**
 * [processRawAttrs 处理使用了v-pre指令的元素及其子元素]
 * @param  {[type]} el [元素的描述对象]
 * @return {[type]}    [将该元素所有属性全部作为原生的属性(attr)处理]
 */
function processRawAttrs (el) {
  const l = el.attrsList.length
  /* el.attrsList 数组的长度为 0 */
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      /*将el.attrsList上的属性全部转移到el.attrs上*/
      attrs[i] = {
        name: el.attrsList[i].name,
        value: JSON.stringify(el.attrsList[i].value) /*.attrs 数组中每个对象的 value 属性值都是通过 JSON.stringify 处理过的*/
      }
    }
  }
  /* v-pre子代无属性元素 */
  else if (!el.pre) {
    /*举个例子如下：
      <div v-pre>
        <span></span>
      </div>

      如上 html 字符串所示，当解析 span 标签时，由于 span 标签没有任何属性，
      并且 span 标签也没有使用 v-pre 指令，所以此时会在 span 标签的元素描述对象上添加 .plain 属性并将其设置为 true，
      用来标识该元素是纯的，在代码生成的部分我们将看到一个被标识为 plain 的元素将有哪些不同。
    */
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

/*  对使用了 v-for 指令的标签所生成的元素描述对象做一个总结：
    1、如果 v-for 指令的值为字符串 'obj in list'，则 processFor 函数的处理为：
    {
      for: 'list',
      alias: 'obj'
    }
    2、如果 v-for 指令的值为字符串 '(obj, index) in list'，则 processFor 函数的处理为：
    {
      for: 'list',
      alias: 'obj',
      iterator1: 'index'
    }
    3、如果 v-for 指令的值为字符串 '(obj, key, index) in list'，则 processFor 函数的处理为：
    {
      for: 'list',
      alias: 'obj',
      iterator1: 'key',
      iterator2: 'index'
    }
*/
/**
 * [processFor 处理使用了v-for指令的元素]
 * @param  {[type]} el: ASTElement    [元素的描述对象]
 * @return {[type]}                   [description]
 */
export function processFor (el: ASTElement) {
  let exp
  /*如果标签的 v-for 属性值存在*/
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
  /* 匹配list
    1、假如我们当前元素是一个使用了 v-for 指令的 div 标签，如下：
       <div v-for="obj in list"></div>
    2、那么 exp 变量的值将是字符串 'obj in list'
    3、最终 inMatch 常量则是一个数组，如下：
       const inMatch = [
          'obj in list',
          'obj',
          'list'
        ]
   */
    const inMatch = exp.match(forAliasRE)
    /*如果匹配失败则 inMatch 常量的值将为 null*/
    if (!inMatch) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid v-for expression: ${exp}`
      )
      return
    }
    /* 匹配list */
    el.for = inMatch[2].trim()
    /* v-for 指令的值与 alias 常量值的对应关系：
       1、如果 v-for 指令的值为 'obj in list'，则 alias 的值为字符串 'obj'
       2、如果 v-for 指令的值为 '(obj, index) in list'，则 alias 的值为字符串 'obj, index'
       3、如果 v-for 指令的值为 '(obj, key, index) in list'，则 alias 的值为字符串 'obj, key, index'
    */
    /* 对于不同的 alias 字符串其对应的匹配结果：
       1、如果 alias 字符串的值为 'obj'，则匹配结果 iteratorMatch 常量的值为 null
       2、如果 alias 字符串的值为 'obj, index'，则匹配结果 iteratorMatch 常量的值是一个包含两个元素的数组：[', index', 'index']
       3、如果 alias 字符串的值为 'obj, key, index'，则匹配结果 iteratorMatch 常量的值是一个包含三个元素的数组：[', key, index', 'key'， 'index']
    */
    /* 匹配obj*/
    const alias = inMatch[1].trim()
    const iteratorMatch = alias.match(forIteratorRE)
    /* alise不为obj */
    if (iteratorMatch) {
      /* el.alias的值为obj */
      el.alias = iteratorMatch[1].trim()
      /* el.iterator1的值为key */
      el.iterator1 = iteratorMatch[2].trim()
      if (iteratorMatch[3]) {
        /* el.iterator1的值为index */
        el.iterator2 = iteratorMatch[3].trim()
      }
    }
    /* alise为obj */
    else {
      /* el.alias的值为obj */
      el.alias = alias
    }
  }
}

/*  对使用了 v-if、v-else-if、v-else 指令的标签所生成的元素描述对象做一个总结：
    1、如果标签使用了 v-if 指令，则该标签的元素描述对象的 el.if 属性存储着 v-if 指令的属性值
    2、如果标签使用了 v-else 指令，则该标签的元素描述对象的 el.else 属性值为 true
    3、如果标签使用了 v-else-if 指令，则该标签的元素描述对象的 el.elseif 属性存储着 v-else-if 指令的属性值
    4、如果标签使用了 v-if 指令，则该标签的元素描述对象的 ifConditions 数组中包含“自己”
    5、如果标签使用了 v-else 或 v-else-if 指令，则该标签的元素描述对象会被添加到与之相符的带有 v-if 指令的元素描述对象的 ifConditions 数组中。
*/
/**
 * [processIf 处理使用了v-if、v-else-if、v-else指令的元素]
 * @param  {[type]} el [元素的描述对象]
 * @return {[type]}    [description]
 */
function processIf (el) {
  /*从该元素描述对象的 attrsList 属性中获取并移除 v-if 指令的值，并将属性值赋值给 exp 常量*/
  const exp = getAndRemoveAttr(el, 'v-if')
  /*v-if指令存在，且值不为空*/
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  }
  /*v-if指令不存在*/
  else {
    /*处理了 v-else 指令*/
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    /*处理了 v-else-if 指令*/
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

/**
 * [processOnce 处理使用了v-once指令的元素]
 * @param  {[type]} el [元素的描述对象]
 * @return {[type]}    [description]
 */
function processOnce (el) {
  /*获取并移除元素描述对象的 attrsList 数组中名字为 v-once 的属性值，并将获取到的属性值赋值给 once 常量*/
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

/**
 * [processElement 其他一系列 process* 函数的集合]
 * @param  {[type]} element: ASTElement      [元素的描述对象]
 * @param  {[type]} options: CompilerOptions [选项参数]
 * @return {[type]}                          [description]
 */
export function processElement (element: ASTElement, options: CompilerOptions) {
  /*处理使用了key属性的元素*/
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

/*  对使用了key属性的元素对象做一个总结：
    1、key 属性不能被应用到 <template> 标签。
    2、使用了 key 属性的标签，其元素描述对象的 el.key 属性保存着 key 属性的值。
*/
/**
 * [processKey 处理使用了key属性的元素]
 * @param  {[type]} el [元素的描述对象]
 * @return {[type]}    [description]
 */
function processKey (el) {
  /*从元素描述对象的 attrsList 数组中获取到属性名字为 key 的属性值*/
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    /*不要在 <template> 标签上使用 key 属性*/
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    /* el.key所有可能的值：
      如果一个标签使用了 key 属性，则该标签的元素描述对象上将被添加 el.key 属性，为了更直观地理解 el.key 属性的值，做一些总结：
      1、例子一：
         <div key="id"></div>
         上例中 div 标签的属性 key 是非绑定属性，所以会将它的值作为普通字符串处理，这时 el.key 属性的值为：
         el.key = JSON.stringify('id')
      2、例子二：
         <div :key="id"></div>
         上例中 div 标签的属性 key 是绑定属性，所以会将它的值作为表达式处理，而非普通字符串，这时 el.key 属性的值为：
         el.key = 'id'
      3、例子三：
         <div :key="id | featId"></div>
         上例中 div 标签的属性 key 是绑定属性，并且应用了过滤器，所以会将它的值与过滤器整合在一起产生一个新的表达式，这时 el.key 属性的值为：
         el.key = '_f("featId")(id)'
      以上就是 el.key 属性的所有可能值。
    */
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
