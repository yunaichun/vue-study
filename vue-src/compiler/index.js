/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'

/*'编译器创建者'createCompiler函数的  创建者*/
import { createCompilerCreator } from './create-compiler'


// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
/* 
  一、createCompiler作用：创建一个编译器，即编译器的创建者
  二、createCompilerCreator作用：'编译器创建者' 的创建者

  三、传递给 createCompilerCreator 函数的参数 baseCompile 在哪里调用的呢？
      肯定是在 createCompiler 函数体内调用的。
*/
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string, // 模板
  options: CompilerOptions // 配置
): CompiledResult {
  const ast = parse(template.trim(), options)
  optimize(ast, options)
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
