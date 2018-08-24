/* @flow */

import { mergeOptions } from '../util/index'

/**
 * [initMixin 全局注册一个混入]
 * @param  {[type]} Vue: GlobalAPI     [Vue构造函数]
 * @return {[type]}                    [返回Vue构造函数]
 */
/*
	全局注册一个混入，影响注册之后所有创建的每个 Vue 实例。
	插件作者可以使用混入，向组件注入自定义的行为。不推荐在应用代码中使用。
*/
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
  	// 合并传入的mixin配置至当前Vue的options配置中
    this.options = mergeOptions(this.options, mixin)
    // 返回Vue构造函数
    return this
  }
}
