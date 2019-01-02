/* @flow */
/*自动执行异步任务队列*/
export function runQueue (
  queue: Array<?NavigationGuard>, /*异步任务队列*/
  fn: Function, /*异步任务队列外围函数*/
  cb: Function /*异步任务队列全部执行完成后的回调函数*/
) {
  const step = index => {
    /*当前 index 大于等于 queue 的长度*/
    if (index >= queue.length) {
      /*执行 cb 回调*/
      cb()
    }
    /*当前 index 小于 queue 的长度*/
    else {
      /*异步任务队列存在此项任务*/
      if (queue[index]) {
        /*执行 fn 函数，传入当前异步任务，回调中执行下一个异步任务*/
        fn(queue[index], () => {
          step(index + 1)
        })
      }
      /*异步任务队列不存在此项任务*/
      else {
        step(index + 1)
      }
    }
  }
  /*从第一个异步任务开始执行*/
  step(0)
}
