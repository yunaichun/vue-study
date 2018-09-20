/* @flow */

/*将字符串模板解析为抽象语法树(AST)*/
import { parse } from './parser/index'
/*优化抽象语法树(AST)的*/
import { optimize } from './optimizer'
/*将抽象语法树(AST)转换为字符串的形式的渲染函数*/
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
  template: string, // 字符串模板
  options: CompilerOptions // 选项参数
): CompiledResult {
  /*调用 parse 函数将字符串模板解析成抽象语法树(AST)*/
  const ast = parse(template.trim(), options)
  /*调用 optimize 函数优化 ast*/
  optimize(ast, options)
  /*调用 generate 函数将 ast 编译成渲染函数*/
  const code = generate(ast, options)
  return {
    ast, /*抽象语法树(ast)*/
    /*
      注意以下提到的渲染函数，都以字符串的形式存在，
      因为真正变成函数的过程是在 compileToFunctions 中使用 new Function() 来完成的
    */
    render: code.render, /*渲染函数(render)*/
    staticRenderFns: code.staticRenderFns /*静态渲染函数(staticRenderFns)*/
  }
})
