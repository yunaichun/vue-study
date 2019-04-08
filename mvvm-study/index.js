/**
 * [observer 调用 Observer 类进行观测]
 * @param  {[type]} data [数据对象]
 * @return {[type]}      [description]
 */
function observer(data) {
    // 基本类型数据就不用再观测了
    if(data == null || typeof data !== 'object') {
        return;
    }
    let ob;
    if (Object.prototype.hasOwnProperty.call(data, '__ob__')) {
        ob = data.__ob__;
    } else {
        ob = new Observer(data);
    }
    return ob;
}
/**
 * [Observer 首先定义辅助构造函数 - 观察者对象]
 * @param {[type]} data [description]
 */
function Observer(data) {
    // 在defineReactive已经实例过Dep; 此处的作用是对子对象或子数组childOb.dep.depend()、数组深层嵌套进行依赖收集e.__ob__.dep.depend()
    this.dep = new Dep();
    // 将Observer实例绑定到当前value的__ob__属性上面; 此处的作用是数组深层嵌套进行依赖收集e.__ob__.dep.depend()、数组操作触发依赖data.__ob__.dep.notify()
    Object.defineProperty(data, '__ob__', {
        value: this,
        enumerable: false,
        writable: true,
        configurable: true
    });
    if (Array.isArray(data)) {
        // 改变数组对象的原型指向【目的是使数组在原型上含有7个数组操作的属性方法名，在对数组进行7个数组操作的时候可以触发收集的依赖】
        data.__proto__ = protoAugment(data);
        // 数组需要遍历每一个成员进行observe(数组可能嵌套数组或对象)
        this.observeArray(data);
    } else {
        this.walk(data);
    }
    
}
function protoAugment(data) { // [{ w: 90 }, 1, 2, 3]
    // 保存原始 Array 原型
    let originalProto = Array.prototype;
    // 通过 Object.create 方法创建一个对象，该对象的原型就是Array.prototype
    let overrideProto = Object.create(Array.prototype); // overrideProto = {}; overrideProto.__proto__ = Array.prototype;
    ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(function(key, index, array) {
        let method = array[index];
        // 使用 Object.defineProperty 给 overrideProto 添加属性，属性的key是对应的数组函数名，value是此函数
        Object.defineProperty(overrideProto, method, {
            value: function() {
                let args = originalProto.slice.apply(arguments);
                let oldValue = JSON.parse(JSON.stringify(data));
                // 调用原始 原型 的数组方法
                let result = originalProto[method].apply(data, args);
                // def(data, '__ob__', new Observer())
                const ob = data.__ob__;

                let inserted;
                switch (method) {
                  case 'push':
                  case 'unshift':
                    inserted = args; // 添加的元素
                    break;
                  case 'splice':
                    inserted = args.slice(2); // 替换的元素
                    break;
                }
                // 如果通过push、unshift、splice新增或替换新的元素进来，对新添加进数组的数据进行检测
                if (inserted) ob.observeArray(inserted);

                // data.a.push()，是执行data.a的原型overrideProto上的push方法，而overrideProto上的push方法是调用Array.prototype上的push方法
                // dep对象通知所有的观察者【此dep与this.dep相同】
                ob.dep.notify(oldValue, data);
                return result;
            },
            writable: true,
            enumerable: false,
            configurable: true
        });
    });
    return overrideProto;
}
Observer.prototype.observeArray = function(items) {
    for (let i = 0, l = items.length; i < l; i++) {
        // 数组需要遍历每一个成员进行observe(数组可能嵌套数组或对象)
        observer(items[i])
    }
}
Observer.prototype.walk = function(data) {
    let keys = Object.keys(data);
    for(let i = 0; i < keys.length; i++){
        // if (keys[i] === '__ob__') { continue; }
        defineReactive(data, keys[i], data[keys[i]]);
    }
}
/**
 * [defineReactive 将data的属性转换为访问器属性]
 * @param  {[type]} data [数据对象]
 * @param  {[type]} key  [数据对象的某个key]
 * @param  {[type]} val  [数据对象的某个key对应的value]
 * @return {[type]}      [description]
 */
function defineReactive(data, key, val) {
    // 在此属性作用域下实例化一个空的依赖收集器
    let dep = new Dep();
    // 递归观测子属性(子属性是数组或者对象)
    // 一、数组：取值时触发childObj.dep依赖收集器，设置值时通过data.__ob__.dep触发收集的依赖: { a: [{ w: [1] }, [1], 3] }
    // 二、对象：通过当前作用域的实例dep = new Dep()触发依赖收集: { a: { w: 1 } }
    let childObj = observer(val);
	Object.defineProperty(data, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            /* 收集当前对象属性的依赖：在 get 中收集数据对象{ a: { w: 1 } }当前属性a的依赖 */
            dep.addSub();
            if (childObj) {
                /* 对子属性进行依赖收集: 
                   1、子属性是对象的情况: { a: { w: 1 } }。在此处无作用，但是vue源码中Vue.$set、Vue.$del触发响应
                   2、子属性是数组的情况: { a: [{ w: [1] }, [1], 3] }。childOb === data.a.__ob__，对数组进行依赖收集
                */
                childObj.dep.addSub();
                /* 对子属性值是数组进行依赖收集: { a: [{ w: [1] }, [1], 3] }
                   1、数组成员是对象的情况: { w: [1] }。在此处无作用，但是vue源码中Vue.$set、Vue.$del触发响应
                   2、数组成员是数组的情况: [1]。e.__ob__.dep.addSub()，对数组进行依赖收集
                */
                if (Array.isArray(val)) {
                    dependArray(val);
                }
            }
            return val;
        },
        set: function(newVal) {
            if (val === newVal) {
                return;
            }
            // 对新值进行观测
            childObj = observer(newVal);
            // 在set 方法中触发所有收集的依赖
            dep.notify(newVal, val);
        }
    });
}
/**
 * [dependArray 数组深层嵌套依赖的收集(数组嵌套对象、数组嵌套数组)]
 * @param  {[type]} value [数组]
 * @return {[type]}       [description]
 */
function dependArray (value) {
    for (let e, i = 0, l = value.length; i < l; i++) {
        e = value[i];
        /* 数组成员是对象或者数组进行依赖收集: { a: [{ w: [1] }, [1], 3] }
           1、数组成员是对象的情况: { w: [1] }。在此处无作用，但是vue源码中Vue.$set、Vue.$del触发响应
           2、数组成员是数组的情况: [1]。e.__ob__.dep.addSub()，对数组进行依赖收集
        */
        e && e.__ob__ && e.__ob__.dep.addSub();
        /* 数组成员是数组：递归执行该方法继续深层依赖收集[{ w: [1] }, [1], 3] */
        if (Array.isArray(e)) {
            dependArray(e);
        }
    }
}
// --------------------------------------------------------------------------------- //
// 在 Watch 中对表达式求值，能够触发 observer 的 get
/**
 * [Watch 数据监听函数]
 * @param {[string]}   exp [监听表达式]
 * @param {Function}   fn  [监听回调函数]
 */
function Watch(exp, fn) {
    this.exp = exp;
    this.fn = fn;
    this.pushTarget(this);
    // 在 Watch 中对表达式求值，能够触发 observer 的 get【这里的data暂时用index.html中的data变量了】
    parsePath(exp)(data);
}
Dep.target = null;
Watch.prototype.pushTarget = function(watch) {
    Dep.target = watch;
}
/**
 * [parsePath 解析路径]
 * @param  {[string]}    path [watch监听的数据和路径]
 * @return {[Function]}       [返回函数]
 */
let bailRE = /[^\w.$]/;
function parsePath (path) {
    if (bailRE.test(path)) {
        return;
    }
    const segments = path.split('.');
    return function(obj) {
        for (let i = 0; i < segments.length; i++) {
            if (!obj) return;
            obj = obj[segments[i]];
        }
        return obj;
    }
}
// --------------------------------------------------------------------------------- //
// data 下的每一个属性都有一个唯一的 Dep 对象，在 get 中收集仅针对该属性的依赖，然后在 set 方法中触发所有收集的依赖
/**
 * [Dep 依赖收集器]
 */
function Dep () {
    this.subs = [];
    this.addSub = function() {
        this.subs.push(Dep.target);
    };
    this.notify = function(newVal, oldVal) {
        for(let i = 0; i < this.subs.length; i++){
            this.subs[i].fn(newVal, oldVal);
        }
    };
}
