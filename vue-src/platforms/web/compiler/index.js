/* @flow */
// 创建编译器的基本配置
import { baseOptions } from './options'

/*
	注意这里的 compiler/index.js 可不是 ./compiler/index.js，
	这里的 compiler/index.js 指的是 src/compiler/index.js 文件
*/
import { createCompiler } from 'compiler/index'

/* 
	createCompiler作用：创建一个编译器，即编译器的创建者
	compileToFunctions 函数是从 createCompiler 函数的返回值中解构出来的
*/
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
