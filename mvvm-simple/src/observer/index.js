import Dep from './dep';
import { arrayMethods } from './array';

// == 返回观察者实例对象
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

// == 观察者对象
export class Observer {
    // == data.__ob__ = new Observer(data)
    // == (new Observer(data)).dep = new Dep();
    constructor(data) {
        this.dep = new Dep();
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
    
    // == 对象响应式处理
    walk(data) {
        let keys = Object.keys(data);
        for(let i = 0; i < keys.length; i++){
            defineReactive(data, keys[i], data[keys[i]]);
        }
    }

    // == 数组响应式处理
    observeArray(items) {
        for (let i = 0, l = items.length; i < l; i++) {
            observer(items[i])
        }
    }
}


// == 将 data 的属性转换为访问器属性 { }                                                                                                                                                                                                                                                                       
export function defineReactive(data, key, val) {
    // == 完成当前 key 依赖的收集
    let dep = new Dep();
    
    // == 当前 val 是对象或数组的话: { w: 1 }、[1]
    let childObj = observer(val);

	Object.defineProperty(data, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            // == 依赖对象已经设置好，开始收集依赖
            if (Dep.target) {
                dep.depend();
                if (childObj) {
                    // == value 是对象，进行依赖添加，如: { w: 1 }
                    childObj.dep.depend();
                    // == value 是数组，递归依赖收集，如: [{ w: [1] }, [1], 3]
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
            childObj = observer(newVal);
            // == 触发收集的依赖
            dep.notify(newVal);
        }
    });
}

// == 递归对数组的依赖收集: [{ w: [1] }, [1], 3]
function dependArray(value) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i];
        // == 数组 item 为对象: { w: [1] }
        e && e.__ob__ && e.__ob__.dep.depend();
        // == 数组 item 为数组: [1]
        if (Array.isArray(e)) {
            dependArray(e);
        }
    }
}

// == target 继承 src
function protoAugment(target, src) {
    target.__proto__ = src;
}
