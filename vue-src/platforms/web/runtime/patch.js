/* @flow */

// nodeOps定义的实际DOM的操作
import * as nodeOps from 'web/runtime/node-ops'
// 执行createPatchFunction函数，返回一个函数
import { createPatchFunction } from 'core/vdom/patch'
// 定义生成VUE DOM的方法： ref、directives
import baseModules from 'core/vdom/modules/index'
// 定义生成DOM的方法钩子函数：attrs、class、props、events、style、transition
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

// 执行createPatchFunction函数，返回一个函数
export const patch: Function = createPatchFunction({ nodeOps, modules })
