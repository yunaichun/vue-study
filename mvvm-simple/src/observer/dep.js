/** 依赖收集函数: Dep.target 存入的是 Watch 实例 */
export default function Dep () {
  this.subs = [];
}
/** 收集依赖: 触发 Watch 的 addDep 方法 */
Dep.prototype.depend = function () {
  if (Dep.target) Dep.target.addDep(this);
}
/** Watch 的 addDep 方法调用 addSub，将当前的 Watch 实例传入 */
Dep.prototype.addSub = function (sub) {
  this.subs.push(sub);
}
/** 设置值的时候触发依赖：调用 Watch 实例的 update 方法 */
Dep.prototype.notify = function (newVal) {
  for(let i = 0; i < this.subs.length; i += 1) {
    this.subs[i].update(newVal);
  }
}

/** 设置观察者对象 */
export function pushTarget (target) {
  Dep.target = target;
}
