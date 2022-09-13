import Dep from './dep';
import { arrayMethods } from './array';

/** 返回 Observer 实例对象 */
export function observer(data) {
  if(data == null || typeof data !== 'object') return;

  /** 数组或对象均有 __ob__ 属性 */
  let ob;
  if (Object.prototype.hasOwnProperty.call(data, '__ob__')) ob = data.__ob__;
  else ob = new Observer(data);

  return ob;
}

/** 数据添加 __ob__ 属性为 Observer 实例 */
function Observer(data) {
  this.dep = new Dep();
  Object.defineProperty(data, '__ob__', {
    value: this,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  if (Array.isArray(data)) {
    /** 重写数组操作方法：目的是在调用数组方法的时候可以触发收集的依赖 */
    protoAugment(data, arrayMethods);
    /** 递归数组每个 item */
    this.observeArray(data);
  } else {
    this.walk(data);
  }
}
/** 遍历数组每一项调用 observer  */
Observer.prototype.observeArray = function (arr) {
  for (let i = 0, len = arr.length; i < len; i += 1) {
    observer(arr[i]);
  }
}
/** 对象响应式处理: 保证对象的每一个 key 的 value 都有 __ob__ 属性 */
Observer.prototype.walk = function (obj) {
  let keys = Object.keys(obj);
  for(let i = 0; i < keys.length; i += 1){
    const key = keys[i];
    defineReactive(obj, key, obj[key]);
  }
}
/** target 继承 src */
function protoAugment(target, src) {
  target.__proto__ = src;
}

/** 将 data 的属性转换为访问器属性 */                                                                                                                                                                                                                                                         
export function defineReactive(data, key, val) {
  /** 1、完成 val 为基本数据类型（非【数组/对象】）的依赖收集 */
  let dep = new Dep();
  /** 2、【数组/对象】执行 observer 函数才会有返回 */
  let childObserverInstance = observer(val);
	Object.defineProperty(data, key, {
    enumerable: true,
    configurable: true,
    get: function() {
      if (Dep.target) {
        /** 通过当前函数内部的 dep 实例收集依赖 */
        dep.depend();
        /** 当前 val 是【数组/对象】的话: { w: 1 }、[ 1 ] */
        if (childObserverInstance) {
          /** 通过 val 的 __ob__.dep 收集依赖 */
          childObserverInstance.dep.depend();
          /** 收集数组的子项依赖 */
          if (Array.isArray(val)) dependArray(val);
        }
      }
      return val;
    },
    set: function(newVal) {
      if (val === newVal) return;
      childObserverInstance = observer(newVal);
      /** 触发收集的依赖 */
      dep.notify(newVal);
    }
  });
}

/** 递归对数组子项的依赖收集 */
function dependArray(arr) {
  for (let i = 0, len = arr.length; i < len; i += 1) {
    const item = arr[i];
    const ob = item && item.__ob__;
    if (ob) ob.dep.depend();
    if (Array.isArray(item)) dependArray(e);
  }
}
