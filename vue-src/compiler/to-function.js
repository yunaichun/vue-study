/* @flow */
/* src/compiler/to-function.js 文件的整个内容，主要作用有以下几点：

  1、缓存编译结果，通过 createCompileToFunctionFn 函数内声明的 cache 常量实现。
  2、调用 compile 函数将模板字符串转成渲染函数字符串
  3、调用 createFunction 函数将渲染函数字符串转成真正的渲染函数
  4、打印编译错误，包括：模板字符串 -> 渲染函数字符串 以及 渲染函数字符串 -> 渲染函数 这两个阶段的错误

  最后，真正的 模板字符串 到 渲染函数字符串 的编译工作实际上是通过调用 compile 函数来完成的，所以接下来我们的任务就是弄清楚 compile 函数。
*/
import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

/**
  定义createCompileToFunctionFn返回的缓存结果
 */
type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

/**
 * [createFunction 定义createCompileToFunctionFn返回的render函数]
 * @param  {[type]} code   [第一个参数 code 为函数体字符串，该字符串将通过 new Function(code) 的方式创建为函数]
 * @param  {[type]} errors [第二个参数 errors 是一个数组，作用是当采用 new Function(code) 创建函数发生错误时用来收集错误的]
 * @return {[type]}        [description]
 */
function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}



/**
 * [createCompileToFunctionFn compileToFunctions函数的创建者]
 * @param  {[type]} compile: Function      [参数是compile函数]
 * @return {[type]}                        [description]
 */
export function createCompileToFunctionFn (compile: Function): Function {
  /*定义编译结果缓存变量对象*/
  const cache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  /* 
    一、compileToFunctions 函数的作用是把传入的模板字符串(template)编译成渲染函数(render)的
    二、最终返回compileToFunctions函数，这才是我们想要的函数
  */
  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    // 使用 extend 函数将 options 的属性混合到新的对象中并重新赋值 options
    options = extend({}, options)
    // 检查选项参数中是否包含 warn，如果没有则使用 baseWarn
    const warn = options.warn || baseWarn
    // 将 options.warn 属性删除
    delete options.warn


    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      /*
        首先这段代码是在非生产环境下执行的，然后使用 try catch 语句块对 new Function('return 1') 这句代码进行错误捕获，
        如果有错误发生且错误的内容中包含诸如 'unsafe-eval' 或者 'CSP' 这些字样的信息时就会给出一个警告。

        我们知道 CSP 全称是内容安全策略，如果你的策略比较严格，那么 new Function() 将会受到影响，从而不能够使用。
        但是将模板字符串编译成渲染函数又依赖 new Function()，所以解决方案有两个：
        1、放宽你的CSP策略
        2、预编译

        总之这段代码的作用就是检测 new Function() 是否可用，并在某些情况下给你一个有用的提示。
      */
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }


    // check cache
    /*
      如果 options.delimiters 存在，则使用 String 方法将其转换成字符串并与 template 拼接作为 key 的值，
      否则直接使用 template 字符串作为 key 的值
    */
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    /*判断 cache[key] 是否存在，如果存在直接返回 cache[key]。这么做的目的是缓存字符串模板的编译结果，防止重复编译，提升性能*/
    if (cache[key]) {
      return cache[key]
    }


    // compile
    /*核心：将模板字符串 -> 渲染函数字符串*/
    const compiled = compile(template, options)

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      /*
        我们知道，在使用 compile 函数对模板进行编译后会返回一个结果 compiled，
        通过上面这段代码我们能够猜到，返回结果 compiled 是一个对象且这个对象可能包含两个属性 errors 和 tips。
        通过这两个属性的名字可知，这两个属性分别包含了编译过程中的错误和提示信息。
        所以上面那段代码的作用就是用来检查使用 compile 对模板进行编译的过程中是否存在错误和提示的，如果存在那么需要将其打印出来。

        另外，这段代码也是运行在非生产环境的，且错误信息 compiled.errors 和提示信息 compiled.tips 都是数组，需要遍历打印，
        不同的是错误信息使用 warn 函数进行打印，而提示信息使用 tip 函数进行打印
      */
      if (compiled.errors && compiled.errors.length) {
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    /*
      一、传递给 createFunction 函数的第一个参数是 compiled.render，所以 compiled.render 应该是一个函数体字符串，且我们知道 compiled 是 compile 函数的返回值，
          这说明：compile 函数编译模板字符串后所得到的是字符串形式的函数体。
      二、传递给 createFunction 函数的第二个参数是之前声明的 fnGenErrors 常量，也就是说当创建函数出错时的错误信息被 push 到这个数组里了。
    */
    res.render = createFunction(compiled.render, fnGenErrors)
    /*
      一、由这段代码可知 res.staticRenderFns 是一个函数数组，是通过对 compiled.staticRenderFns 遍历生成的，
      二、这说明：compiled 除了包含 render 字符串外，还包含一个字符串数组 staticRenderFns，且这个字符串数组最终也通过 createFunction 转为函数。
      三、staticRenderFns 的主要作用是渲染优化。
    */
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      /*
        这段代码主要的作用是用来打印在生成渲染函数过程中的错误，也就是上面定义的常量 fnGenErrors 中所收集的错误。注释中写的很清楚，
        这段代码的作用主要是用于开发 codegen 功能时使用，一般是编译器本身的错误，所以对于我们来讲基本用不到。
      */
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

   /* 返回编译结果的同时，将结果缓存，这样下一次发现如果 cache 中存在相同的 key 则不需要再次编译，直接使用缓存的结果就可以了。*/
    return (cache[key] = res)
  }
}
