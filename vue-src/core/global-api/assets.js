/* @flow */

import config from '../config'
import { ASSET_TYPES } from 'shared/constants'
import { warn, isPlainObject } from '../util/index'

/**
 * [initAssetRegisters 全局注册组件，指令和过滤器：Vue.component、Vue.directive、Vue.filter]
 * @param  {[type]} Vue: GlobalAPI     [Vue构造函数]
 * @return {[type]}                    [返回Vue构造函数]
 */
export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } 

      else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
          if (type === 'component' && config.isReservedTag(id)) {
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            )
          }
        }
        // 注册或获取全局组件。注册还会自动使用给定的id设置组件的名称
        /*
          1、注册组件，传入一个扩展过的构造器
          Vue.component('my-component', Vue.extend({  }))

          2、注册组件，传入一个选项对象 (自动调用 Vue.extend)
          Vue.component('my-component', {   })

          3、获取注册的组件 (始终返回构造器)
          var MyComponent = Vue.component('my-component')
        */
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
