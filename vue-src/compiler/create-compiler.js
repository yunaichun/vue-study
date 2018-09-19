/* @flow */

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
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

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

      const compiled = baseCompile(template, finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
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
