import klass from './class'
import style from './style'
import model from './model'

/*
	一、返回一个数组，数组有三个元素 klass、style 以及 model，
	    并且这三个元素来自于当前目录下的三个相应名称的 js 文件

	二、简单查看这三个文件的输出，如下：
		// klass.js 的输出
		export default {
		  staticKeys: ['staticClass'],
		  transformNode,
		  genData
		}
		// style.js 的输出
		export default {
		  staticKeys: ['staticStyle'],
		  transformNode,
		  genData
		}
		// model.js 的输出
		export default {
		  preTransformNode
		}


	三、最终 platforms/web/compiler/modules/index.js 文件将这三个文件的输出综合为一个数组进行输出，所以其输出的内容为：
		[
		  {
		    staticKeys: ['staticClass'],
		    transformNode,
		    genData
		  },
		  {
		    staticKeys: ['staticStyle'],
		    transformNode,
		    genData
		  },
		  {
		    preTransformNode
		  }
		]
*/
export default [
  klass,
  style,
  model
]
