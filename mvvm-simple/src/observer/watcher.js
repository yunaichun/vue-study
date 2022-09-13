import { pushTarget } from './dep';

/** 数据监听函数 */
export default function Watch(data, exp, cb) {
  this.data = data;
  this.exp = exp;
  this.cb = cb;

  this.getter = parsePath(exp);
  this.value = this.get();
}
/** 取值触发依赖收集 */
Watch.prototype.get = function () {
  /** 1、设置 Dep.target */
  pushTarget(this);
  /** 2、对 data 取值，触发依赖收集 */
  const value = this.getter(this.data);
  return value;
}
/** 收集依赖: Dep 的 depend 方法会调用 */
Watch.prototype.addDep = function (dep) {
  /** 调用 Dep 的 addSub 方法，将当前的 Watch 实例传入 */
  dep.addSub(this);
}
/** 设置值触发收集的依赖 */
Watch.prototype.update = function (newVal) {
  const oldVal = this.value;
  this.cb(newVal, oldVal);
}

/** 根据 path 中的 . 获取 obj 的层级 value */
function parsePath(path) {
  const bailRE = /[^\w.$]/;
  if (bailRE.test(path)) return;
  const segments = path.split('.');
  return function(obj) {
    for (let i = 0; i < segments.length; i += 1) {
      if (!obj) return;
      obj = obj[segments[i]];
    }
    return obj;
  }
}
