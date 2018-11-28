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
  /* 调用 parse 函数将字符串模板解析成抽象语法树(AST) ：
     parse 会用正则等方式解析 template 模板中的指令、class、style等数据，形成AST
  */
  const ast = parse(template.trim(), options)
  /* 调用 optimize 函数优化 ast：
     optimize 的主要作用是标记 static 静态节点，这是 Vue 在编译过程中的一处优化，后面当 update 更新界面时，会有一个 patch 的过程，
     diff 算法会直接跳过静态节点，从而减少了比较的过程，优化了 patch 的性能。
     */
  optimize(ast, options)
  /* 调用 generate 函数将 ast 编译成渲染函数：
     generate 是将 AST 转化成 render function 字符串的过程，得到结果是 render 的字符串以及 staticRenderFns 字符串。
  */
  const code = generate(ast, options)
  return {
    ast, /*抽象语法树(ast)*/
    /*
      注意以下提到的渲染函数，都以字符串的形式存在，
      因为真正变成函数的过程是在 compileToFunctions 中使用 new Function() 来完成的
    */
    render: code.render, /*渲染函数(render)：字符串形式*/
    staticRenderFns: code.staticRenderFns /*静态渲染函数(staticRenderFns)：字符串形式*/
  }
})
