/*
1、Vue.prototype 下的属性和方法的挂载主要是在 src/core/instance 目录中的代码处理的

2、Vue 下的静态属性和方法的挂载主要是在 src/core/global-api 目录下的代码处理的

3、web-runtime.js 主要是添加web平台特有的配置、组件和指令，
   web-runtime-with-compiler.js 给Vue的 $mount 方法添加 compiler 编译器，支持 template，将模板 template 编译为render函数。
*/

/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { shouldDecodeNewlines } from './util/compat'
import { compileToFunctions } from './compiler/index'


// 缓存来自web/runtime/index.js文件的$mount函数 (不带编译 $mount 方法)
const mount = Vue.prototype.$mount
/* 
1、运行时版 Vue 的入口文件
2、完整版 Vue 的入口文件，重新定义了 $mount 函数，但是保留了运行时 $mount 的功能，并在此基础上为 $mount 函数添加了编译模板的能力
*/
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 根据el获取相应的DOM元素：可以传入元素属性名，也可以直接传入DOM节点。
  // 这个元素我们称之为挂载点
  el = el && query(el)

  /* istanbul ignore if */
  // 载点的本意是 组件挂载的占位，它将会被组件自身的模板 替换掉，而 <body> 元素和 <html> 元素显然是不能被替换掉的。
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // options中没有render 选项：编译template生成render
  if (!options.render) {
    let template = options.template
    // options中有template选项：通过template获取DOM元素节点
    if (template) {
      // template是字符串：template:"#template"
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          // 返回此template的innerHTML
          template = idToTemplate(template)
          /* istanbul ignore if */
          // 开发环境报错：不存在节点
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      }
      // 当template为DOM节点：template: `<h1 style="color:red">第一种写法</h1>`
      else if (template.nodeType) {
        template = template.innerHTML
      }
      // template存在但不合法
      else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } 
    // options中没有template选项：通过el选项获取DOM元素节点
    else if (el) {
      // 获取el元素起始位置到终止位置的全部内容 (包含本身)
      template = getOuterHTML(el)
    }

    // options中有template选项或有el选项时：DOM元素节点
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        // 创建开始编译标记：用于前端统计性能
        mark('compile')
      }

      /* 
        一、compileToFunctions 函数的作用是把传入的模板字符串(template)编译成渲染函数(render)的
        二、static静态不需要在VNode更新时进行patch，优化性能
      */
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines, // 当设为 true 时，意味着 Vue 在编译模板的时候，要对属性值中的换行符做兼容处理
        delimiters: options.delimiters, // 改变纯文本插入分隔符；默认值：["{{", "}}"]
        comments: options.comments // 当设为 true 时，将会保留且渲染模板中的 HTML 注释。默认值：false
      }, this)
      // 将编译成的 render 函数挂载到 this.$options 属性下
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        // 创建结束编译标记：用于前端统计性能
        mark('compile end')
        // 统计开始编译和结束编译的时间
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 调用已经缓存下来的web/runtime/index.js文件中的不带编译 $mount 方法
  return mount.call(this, el, hydrating)
}

// 返回此id的innerHTML内容
const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
// 获取el元素起始位置到终止位置的全部内容 (包含本身)
function getOuterHTML (el: Element): string {
  // IE浏览器
  if (el.outerHTML) {
    return el.outerHTML
  }
  // 非IE浏览器
  else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

// 在 Vue 上挂载 compile，支持 template
// compileToFunctions函数的作用，就是将模板 template 编译为render函数 (web/compiler/index.js)
Vue.compile = compileToFunctions

export default Vue
