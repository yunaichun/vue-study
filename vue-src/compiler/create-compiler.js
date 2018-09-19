/* @flow */
/* src/compiler/create-compiler.js 文件中compile 函数的作用，它的作用主要有三个：

1、生成最终编译器选项 finalOptions
2、对错误的收集
3、调用 baseCompile 编译模板
*/

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'

/*compileToFunctions函数的创建者，参数是compile函数*/
import { createCompileToFunctionFn } from './to-function'


/**
 * [createCompilerCreator '编译器创建者'createCompiler函数的  创建者]
 * @param  {[type]} baseCompile: Function      [description]
 * @return {[type]}                            [description]
 */
/* 
  传递给 createCompilerCreator 函数的参数 baseCompile 在哪里调用的呢？
  肯定是在 createCompiler 函数体内调用的。
*/
export function createCompilerCreator (baseCompile: Function): Function {
  /*返回'编译器创建者'createCompiler函数*/
  return function createCompiler (baseOptions: CompilerOptions) {

    /*定义 compile 函数，最终返回此 compile 函数*/
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      /*以 baseOptions 为原型创建 finalOptions 常量，finalOptions 才是最终的编译选项参数*/
      const finalOptions = Object.create(baseOptions)
      // 定义了两个常量：errors 和 tips 且它们的值都是数组
      const errors = []
      const tips = []
      /*
        在 finalOptions 上添加了 warn 函数。该函数接收两个参数：
        1、msg 错误或提示的信息，
        2、tip 用来标示 msg 是错误还是提示。

        可以猜想的到 warn 选项主要用在编译过程中的错误和提示收集，
        如果收集的信息是错误信息就将错误信息添加到前面定义的 errors 数组里，
        如果是提示信息就将其添加到 tips 数组里。
      */
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }



      /*
        一、这里的 options 就是使用编译器编译模板时传递的选项参数，或者可以简单理解为调用 compileToFunctions 函数时传递的选项参数。
        二、我们可以把 baseOptions 理解为编译器的默认选项或者基本选项，而 options 是用来提供定制能力的扩展选项。
        三、而下面这段代码的作用，就是将 options 对象混合到 finalOptions 中
      */
      if (options) {
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }



      /*
        一、compile 函数对模板的编译是委托 baseCompile 完成的。
        二、baseCompile 函数是 createCompilerCreator 函数的形参，是在 src/compiler/index.js 文件中调用 createCompilerCreator 创建 '编译器创建者' 的创建者时 传递过来的
      */
      const compiled = baseCompile(template, finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        /*
          一、compiled 是 baseCompile 对模板的编译结果，该结果中包含了模板编译后的抽象语法树(AST)，可以通过 compiled.ast 访问该语法树，
          二、所以下面这段代码的作用是用来通过抽象语法树来检查模板中是否存在错误表达式的，通过 detectErrors 函数实现，
          三、将 compiled.ast 作为参数传递给 detectErrors 函数，该函数最终返回一个数组，该数组中包含了所有错误的收集，最终通过这句代码将错误添加到 errors 数组中：
        */
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      /*将收集到的错误(errors)和提示(tips)添加到 compiled 上并返回*/
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    /*最终返回一个对象，包含compile和compileToFunctions函数*/
    return {
      compile,
      /* 
        一、compileToFunctions 函数的作用是把传入的模板字符串(template)编译成渲染函数(render)的
        二、compileToFunctions 这个函数是通过以 compile 函数作为参数调用 createCompileToFunctionFn 函数生成的，
            所以我们一直所说的 compileToFunctions 函数其实准确的讲它应该是 createCompileToFunctionFn 函数的返回值
      */
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
