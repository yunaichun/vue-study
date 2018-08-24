/* @flow */

import { toArray } from '../util/index'

/**
 * [initUse 安装 Vue.js 插件]
 * @param  {[type]} Vue: GlobalAPI     [Vue构造函数]
 * @return {[type]}                    [返回Vue构造函数]
 */
/*
  如果插件是一个对象，必须提供 install 方法。如果插件是一个函数，它会被作为 install 方法。
  install 方法调用时，会将 Vue 作为参数传入。
  当 install 方法被同一个插件多次调用，插件将只会被安装一次。
*/
export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // this._installedPlugins初始为空数组
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 如果连续安装相同插件，直接返回
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    // 获取Vue.use函数参数，同时转换成数组
    const args = toArray(arguments, 1)
    // 将Vue构造函数添加至参数第一个位置：install 方法调用时，会将 Vue 作为参数传入
    args.unshift(this)
    // 如果插件是一个对象，必须提供 install 方法
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } 
    // 如果插件是一个函数，它会被作为 install 方法
    else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    // 将plugin添加至installedPlugins数组中，避免重复安装，直接取缓存就可以了
    installedPlugins.push(plugin)
    // 返回Vue构造函数
    return this
  }
}
