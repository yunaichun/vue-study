/* @flow */
// 创建编译器的基本配置
import { baseOptions } from './options'
// 调用来自compiler编译器中的创建编译器方法
import { createCompiler } from 'compiler/index'

// 这里会根据不同平台传递不同的baseOptions创建编译器
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
