const arrayProto = Array.prototype;
export const arrayMethods = Object.create(arrayProto);

;['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(function(method) {
  Object.defineProperty(arrayMethods, method, {
    value: function(...args) {
      const result = arrayProto[method].apply(this, args);
      const ob = this.__ob__;

      /** 对新添加进数组的数据进行检测 */
      let inserted;
      if (method === 'push' || method === 'unshift') inserted = args;
      else if (method === 'splice') inserted = args.slice(2);
      if (inserted) ob.observeArray(inserted);

      /** dep 对象通知所有的观察者 */
      ob.dep.notify(this);
      return result;
    },
    writable: true,
    enumerable: false,
    configurable: true
  });
});
