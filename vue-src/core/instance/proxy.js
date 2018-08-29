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



  // 该处是对es6特性Proxy的检测，其检测手段是确认Proxy是原生实现并未被用户代码所覆盖
  const hasProxy = typeof Proxy !== 'undefined' && Proxy.toString().match(/native code/)
  // 宿主环境支持 Proxy
  if (hasProxy) {
    // isBuiltInModifier 函数用来检测是否是内置的修饰符
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    // 为 config.keyCodes 设置了 set 代理，其目的是防止开发者在自定义键位别名的时候，覆盖了内置的修饰符
    config.keyCodes = new Proxy(config.keyCodes, {
      set (target, key, value) {
        // 禁止用户修改Vue内建的一些按键值
        if (isBuiltInModifier(key)) {
          // Vue.config.keyCodes.shift = 16
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          // 如果是非内置的修饰符，那么可以直接设置上
          target[key] = value
          return true
        }
      }
    })
  }



  /*
  hasHandler可以拦截以下操作:
  1、属性查询: foo in proxy
  2、继承属性查询: foo in Object.create(proxy)
  3、with 检查: with(proxy) { (foo); }
  4、Reflect.has()
  */
  /* with 检查: with(proxy) { (foo); }

    打开 core/instance/render.js 文件，找到 Vue.prototype._render 方法，里面有这样的代码：

    vnode = render.call(vm._renderProxy, vm.$createElement)

    可以发现，调用 render 函数的时候，使用 call 方法指定了函数的执行环境为 vm._renderProxy，渲染函数长成什么样呢？还是以上面的例子为例，我们可以通过打印 vm.$options.render 查看，所以它长成这样：

    vm.$options.render = function () {
        // render 函数的 this 指向实例的 _renderProxy
        with(this){
            return _c('div', [_v(_s(a))])   // 在这里访问 a，相当于访问 vm._renderProxy.a
        }
    }
    从上面的代码可以发现，显然函数使用 with 语句块指定了内部代码的执行环境为 this，
    由于 render 函数调用的时候使用 call 指定了其 this 指向为 vm._renderProxy，
    所以 with 语句块内代码的执行环境就是 vm._renderProxy，所以在 with 语句块内访问 a 就相当于访问 vm._renderProxy 的 a 属性，
    前面我们提到过 with 语句块内访问变量将会被 Proxy 的 has 代理所拦截，所以自然就执行了 has 函数内的代码。
    最终通过 warnNonPresent 打印警告信息给我们，所以这个代理的作用就是为了给在开发阶段给我们一个友好而准确的提示。
  */
  const hasHandler = {
    has (target, key) {
      // 首先使用in操作符判断该属性是否在vm实例上存在
      const has = key in target
      // 如果 key 在 allowedGlobals 之内，或者 key 以下划线 _ 开头的字符串，则为真
      const isAllowed = allowedGlobals(key) || key.charAt(0) === '_'
      /*
        当访问了一个虽然不在实例对象上(或原型链上)的属性，但如果你访问的是全局对象那么也是被允许的。
        这样我们就可以在模板中使用全局对象了，如：

        <template>
          {{Number(b) + 2}}
        </template>

        其中 Number 为全局对象，如果去掉 !isAllowed 这个判断条件，那么上面模板的写法将会得到警告信息。
        除了允许使用全局对象之外，还允许方法以 _ 开头的属性，这么做是由于渲染函数中会包含很多以 _ 开头的内部方法，如之前我们查看渲染函数时遇到的 _c、_v 等等。
      */
      // 如果 has 和 isAllowed 都为假，使用 warnNonPresent 函数打印错误
      if (!has && !isAllowed) {
        warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }



  /*
    其实 _withStripped 只在 test/unit/features/instance/render-proxy.spec.js 文件中出现过，该文件有这样一段代码：

    it('should warn missing property in render fns without `with`', () => {
        const render = function (h) {
            // 这里访问了 a
            return h('div', [this.a])
        }
        // 在这里将 render._withStripped 设置为 true
        render._withStripped = true
        new Vue({
            render
        }).$mount()
        // 应该得到警告
        expect(`Property or method "a" is not defined`).toHaveBeenWarned()
    })

    这个时候就会触发 getHandler 设置的 get 拦截
  */
 /* 想要得到警告我们需要手动设置 render._withStripped 为 true
    const render = function (h) {
        return h('div', [this.a])
    }
    render._withStripped = true

    var vm = new Vue({
        el: '#app',
        render,
        data: {
            test: 1
        }
    })

    为什么会这么设计呢？
    因为在使用 webpack 配合 vue-loader 的环境中， vue-loader 会借助 vuejs@component-compiler-utils 将 template 编译为不使用 with 语句包裹的遵循严格模式的 JavaScript，
    并为编译后的 render 方法设置 render._withStripped = true。

    在不使用 with 语句的 render 方法中，模板内的变量都是通过属性访问操作 vm['a'] 或 vm.a 的形式访问的，
    从前文中我们了解到 Proxy 的 has 无法拦截属性访问操作，
    所以这里需要使用 Proxy 中可以拦截到属性访问的 get，
    同时也省去了 has 中的全局变量检查(全局变量的的访问不会被 get 拦截)。
  */
  const getHandler = {
    get (target, key) {
      // 访问的属性不是string类型或者属性值在被代理的对象上不存在，则抛出错误提示，否则就返回该属性值
      if (typeof key === 'string' && !(key in target)) {
        warnNonPresent(target, key)
      }
      return target[key]
    }
  }


  // 设置渲染函数的作用域代理
  initProxy = function initProxy (vm) {
    // 宿主环境支持 Proxy
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      // options.render._withStripped 这个属性只在测试代码中出现过，所以一般情况下这个条件都会为假，也就是使用 hasHandler 作为代理配置
      const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
      // 使用 Proxy 对 vm 做一层代理，代理对象赋值给 vm._renderProxy
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      // 直接把vm实例赋值给_renderProxy属性值
      vm._renderProxy = vm
    }
  }
}

export { initProxy }


/*
  一、Proxy 可以理解成，在目标对象之前架设一层“拦截”，外界对该对象的访问，都必须先通过这层拦截，因此提供了一种机制，可以对外界的访问进行过滤和改写。
  二、Proxy 这个词的原意是代理，用在这里表示由它来“代理”某些操作，可以译为“代理器”
  三、new Proxy()表示生成一个Proxy实例，target参数表示所要拦截的目标对象，handler参数也是一个对象，用来定制拦截行为
*/