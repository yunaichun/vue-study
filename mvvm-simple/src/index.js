import { observer } from './observer/index';
import Watcher from './observer/watcher';

/** 第一步: 定义一个普通对象作为数据模型 */
var data = {
  a: 200,
  level1: {
    b: 'str',
    c: [{ w: 90 }, { x: [1] }, 3],
    level2: {
      w: 90,
      x: [1]
    }
  }
};

/** 第二步: 返回观察者实例对象 */
observer(data);

/** 第三步: 定义观察者 Watcher。当数据 data 有变化时，执行相应的回调方法 */
/** 1、检测对象 */
new Watcher(data, 'a', function(newVal, oldVal) {
  console.log('新值: ' + newVal + '----' + '旧值: ' + oldVal);
});
data.a = 300;
console.log('data', data);

/** 2、监测对象嵌套对象 */
new Watcher(data, 'level1.level2.w', function(newVal, oldVal) {
  console.log('新值: ' + newVal + '----' + '旧值: ' + oldVal);
});
data.level1.level2.w = 'modifystr';

/** 3、监测对象嵌套数组 */
new Watcher(data, 'level1.level2.x', function(newVal, oldVal) {
  console.log('新值: ' + newVal + '----' + '旧值: ' + oldVal);
});
data.level1.level2.x.push(2);
 
/** 4、监测数组 */
new Watcher(data, 'level1.c', function(newVal, oldVal) {
  console.log('新值: ' + newVal + '----' + '旧值: ' + oldVal);
});
data.level1.c.push(4);

/** 5、监测数组嵌套对象 */
new Watcher(data, 'level1.c.0.w', function(newVal, oldVal) {
  console.log('新值: ' + newVal + '----' + '旧值: ' + oldVal);
});
data.level1.c[0].w = 100;

/** 6、监测数组嵌套数组 */
new Watcher(data, 'level1.c.1.x', function(newVal, oldVal) {
  console.log('新值: ' + newVal + '----' + '旧值: ' + oldVal);
});
data.level1.c[1].x.push(4);
