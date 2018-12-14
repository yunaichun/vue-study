const devtoolHook =
  typeof window !== 'undefined' &&
  window.__VUE_DEVTOOLS_GLOBAL_HOOK__

/**
 * [devtoolPlugin 注入插件]
 * @param  {[Class]} store [store 实例 this]
 * @return {[type]}        [description]
 */
export default function devtoolPlugin (store) {
  if (!devtoolHook) return

  store._devtoolHook = devtoolHook

  /*一、触发 Vuex 组件初始化的 hook */
  devtoolHook.emit('vuex:init', store)

  /*二、提供“时空穿梭”功能，即 state 操作的前进和倒退*/
  devtoolHook.on('vuex:travel-to-state', targetState => {
    store.replaceState(targetState)
  })

 /* 三、mutation 被执行时，触发hook，并提供被触发的 mutation 函数和当前的 state 状态*/
  store.subscribe((mutation, state) => {
    devtoolHook.emit('vuex:mutation', mutation, state)
  })
}
