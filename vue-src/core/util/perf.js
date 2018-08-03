import { inBrowser } from './env'

export let mark
export let measure

if (process.env.NODE_ENV !== 'production') {
  // 在浏览器环境下是存在window.performance的
  const perf = inBrowser && window.performance
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    // 创建标记name
    mark = tag => perf.mark(tag)
    measure = (name, startTag, endTag) => {
      // 记录两个标记的时间间隔
      perf.measure(name, startTag, endTag)
      // 清除指定标记startTag
      perf.clearMarks(startTag)
      // 清除指定标记endTag
      perf.clearMarks(endTag)
      // 清除指定清除指定记录间隔数据name
      perf.clearMeasures(name)
    }
  }
}
