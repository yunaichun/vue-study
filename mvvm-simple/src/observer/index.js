import Dep from './dep';
import { arrayMethods } from './array';

// == 返回 Observer 实例对象
export function observer(data) {
    if(data == null || typeof data !== 'object') {
        return;
    }

    // == 数组或对象均有 __ob__ 属性
    let ob;
    if (Object.prototype.hasOwnProperty.call(data, '__ob__')) {
        ob = data.__ob__;
    } else {
        ob = new Observer(data);
    }
    return ob;
}

// == 数据添加 __ob__ 属性为 Observer 实例
// == 一、data.__ob__ = new Observer(data);
// == 二、data.__ob__.dep = new Dep();
// == 1、当前 val 为对象或数组时，依赖由当前 val 的 __ob__.dep 收集
// == 2、当前 val 为数组时，子项为对象或数组的话，依赖由当前 val 的子项的 __ob__.dep 收集
export class Observer {
    constructor(data) {
        this.dep = new Dep();
        
        // == 数组或对象均有 __ob__ 属性
        Object.defineProperty(data, '__ob__', {
            value: this,
            enumerable: false,
            writable: true,
            configurable: true
        });

        if (!Array.isArray(data)) {
            this.walk(data);
        } else {
            // == 重写数组操作方法：目的是在调用数组方法的时候可以触发收集的依赖
            protoAugment(data, arrayMethods);
            // == 遍历数组每一项调用 observer 
            this.observeArray(data);
        }
    }
    
    // == 对象响应式处理: 保证对象的每一个 key 的 value 都有 __ob__ 属性
    walk(data) {
        let keys = Object.keys(data);
        for(let i = 0; i < keys.length; i++){
            defineReactive(data, keys[i], data[keys[i]]);
        }
    }

    // == 数组响应式处理: 保证数组的每一个 item 都有 __ob__ 属性
    observeArray(items) {
        for (let i = 0, l = items.length; i < l; i++) {
            observer(items[i])
        }
    }
}


// == 将 data 的属性转换为访问器属性                                                                                                                                                                                                                                                                      
export function defineReactive(data, key, val) {
    // == 1、完成 val 为基本数据类型（非对象或数组）的依赖收集
    let dep = new Dep();
    
    // == 2、这一步可知数组或对象有一个 __ob__.dep 的属性，完成 val 为对象或数组的依赖收集
    let childObserverInstance = observer(val);

	Object.defineProperty(data, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            // == 依赖对象已经设置好，开始收集依赖
            if (Dep.target) {
                dep.depend();
                // == 1、当前 val 为对象或数组时，依赖由当前 val 的 __ob__.dep 收集
                // == 当前 val 是对象或数组的话: { w: 1 }、[ 1 ]
                if (childObserverInstance) {
                    // == 3、由此可以看出当前 val 为对象或数组时，依赖由当前 val 的 __ob__.dep 收集
                    childObserverInstance.dep.depend();
                    // == 4、由此可以看出 val 为数组时，子项为对象或数组的话，依赖由当前 val 的子项的 __ob__.dep 收集
                    if (Array.isArray(val)) {
                        dependArray(val);
                    }
                }
            }
            return val;
        },
        set: function(newVal) {
            if (val === newVal) {
                return;
            }
            childObserverInstance = observer(newVal);
            // == 触发收集的依赖
            dep.notify(newVal);
        }
    });
}

// == 递归对数组子项的依赖收集
function dependArray(value) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i];
        e && e.__ob__ && e.__ob__.dep.depend();
        if (Array.isArray(e)) {
            dependArray(e);
        }
    }
}

// == target 继承 src
function protoAugment(target, src) {
    target.__proto__ = src;
}
