/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap } from '../util/index'

let initProxy

// 开发环境
if (process.env.NODE_ENV !== 'production') {
  // 判断某个key值是否在参数对象中(是一个函数)
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )
  // 传入键名或方法名，log显示一条警告
  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }
  // 该处是对es6特性Proxy的检测， 
  // 其检测手段是确认Proxy是原生实现并未被用户代码所覆盖
  const hasProxy =
    typeof Proxy !== 'undefined' &&
    Proxy.toString().match(/native code/)
  // 对config.keyCodes设置一个代理，
  // 在set赋值的时候先从isBuiltInModifier里检查，不存在再赋值
  if (hasProxy) {
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
        // 禁止用户修改Vue内建的一些按键值
        if (isBuiltInModifier(key)) {
          // config.keyCodes['stop'] = xxx 这样是不允许的
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          // 如果非内建内容，那么可以直接设置上
          target[key] = value
          return true
        }
      }
    })
  }
  // hasHandler方法的应用场景在于查看vm实例是否拥有某个属性。
  // 比如调用for in循环遍历vm实例属性时，会触发hasHandler方法。
  const hasHandler = {
    has (target, key) {
      // 首先使用in操作符判断该属性是否在vm实例上存在
      const has = key in target
      const isAllowed = allowedGlobals(key) || key.charAt(0) === '_'
      // 如果属性名在vm上不存在，且不在特殊属性名称映射表中，或没有以_符号开头，则抛出异常
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }
  // 该方法可以在开发者错误的调用vm属性时，提供提示作用。
  const getHandler = {
    get (target, key) {
      // 访问的属性不是string类型或者属性值在被代理的对象上不存在，则抛出错误提示，否则就返回该属性值
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  initProxy = function initProxy (vm) {
    // 如果Proxy属性存在，则把包装后的vm属性赋值给_renderProxy属性值，否则把vm是实例本身赋值给_renderProxy属性
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      // 如果options上存在render属性，且render属性上存在_withStripped属性: 
      // 则proxy的traps(traps其实也就是自定义方法)采用getHandler方法,否则采用hasHandler方法
      const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
      // 把包装后的vm属性赋值给_renderProxy属性值
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      // 直接把vm实例赋值给_renderProxy属性值
      vm._renderProxy = vm
    }
  }
}

export { initProxy }

// Proxy 可以理解成，在目标对象之前架设一层“拦截”，外界对该对象的访问，都必须先通过这层拦截，因此提供了一种机制，可以对外界的访问进行过滤和改写。
// Proxy 这个词的原意是代理，用在这里表示由它来“代理”某些操作，可以译为“代理器”
// new Proxy()表示生成一个Proxy实例，target参数表示所要拦截的目标对象，handler参数也是一个对象，用来定制拦截行为