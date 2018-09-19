/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

/*createCompiler函数的参数(src/platforms/web/compiler/index.js)*/
export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules, // 返回一个数组，数组有三个元素 klass、style 以及 model
  directives, // 返回一个对象，对象有三个元素 model、html 以及 text
  isPreTag, // 是一个函数，通过给定的标签名字检查标签是否是 'pre' 标签
  isUnaryTag, // 是一个通过 makeMap 生成的函数，该函数的作用是检测给定的标签是否是一元标签
  mustUseProp, // 其作用是用来检测一个属性在标签中是否要使用 props 进行绑定
  canBeLeftOpenTag, // 是一个通过 makeMap 生成的函数，它的作用是检测一个标签是否是那些虽然不是一元标签，但却可以自己补全并闭合的标签。
  isReservedTag, // 是一个通过 makeMap 生成的函数，其作用是检查给定的标签是否是保留的标签。
  getTagNamespace, // 其作用是获取元素(标签)的命名空间
  staticKeys: genStaticKeys(modules) // 其作用是根据编译器选项的 modules 选项生成一个静态键字符串
}
