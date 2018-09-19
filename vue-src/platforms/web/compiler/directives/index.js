import model from './model'
import text from './text'
import html from './html'

/*
	一、最终输出一个对象，这个对象包含三个属性 model、text 以及 html，
	    这三个属性同样来自于当前目录下的三个文件：model.js、text.js 以及 html.js 文件。

	二、简单查看这三个文件的输出，如下：
		// model.js 的输出
		export default function model (
		  el: ASTElement,
		  dir: ASTDirective,
		  _warn: Function
		): ?boolean {
		  // 函数体...
		}
		// html.js 的输出
		export default function html (el: ASTElement, dir: ASTDirective) {
		  if (dir.value) {
		    addProp(el, 'innerHTML', `_s(${dir.value})`)
		  }
		}
		// text.js 的输出
		export default function text (el: ASTElement, dir: ASTDirective) {
		  if (dir.value) {
		    addProp(el, 'textContent', `_s(${dir.value})`)
		  }
		}
		
	三、这个三个文件分别输出了三个函数，所以最终 baseOptions 对象的 directives 属性如下：
		{
		  model: function(){},
		  html: function(){},
		  text: function(){}
		}
*/
export default {
  model,
  text,
  html
}
