/* @flow */

import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
/*
	1、创建一个 div
	2、设置这个 div 的 innerHTML 为 <div a="\n"/>
	3、获取该 div 的 innerHTML 并检测换行符是否被编码
*/
function shouldDecode (content: string, encoded: string): boolean {
  const div = document.createElement('div')
  div.innerHTML = `<div a="${content}"/>`
  return div.innerHTML.indexOf(encoded) > 0
}

// #3663
// IE encodes newlines inside attribute values while other browsers don't
/* 
	作用：检测div标签属性中换行符是否被编码。
	结果：如果 shouldDecodeNewlines 为 true，意味着 Vue 在编译模板的时候，要对属性值中的换行符做兼容处理
*/
export const shouldDecodeNewlines = inBrowser ? shouldDecode('\n', '&#10;') : false


/*
	假设我们有如下 DOM：
	<div id="link-box">
	  <!-- 注意 href 属性值，链接后面加了一个换行 -->
	  <a href="http://hcysun.me
	  ">aaaa</a>
	  <!-- 注意 href 属性值，链接后面加了一个Tab -->
	  <a href="http://hcysun.me	">bbbb</a>
	</div>

	上面的 DOM 看上去貌似没有什么奇特的地方，关键点在于 <a> 标签的 href 属性，
	我们在第一个 <a> 标签的 href 属性值后面添加了换行符，在第二个 <a> 标签的 href 属性值后面添加了制表符。那么这么做会有什么影响呢？
	执行下面的代码就显而易见了：
	console.log(document.getElementById('link-box').innerHTML)

	上面的代码中我们打印了 id 为 link-box 的 innerHTML，如下图：
	<a href="http://hcysun.me&#10  ">aaaa</a>
	<a href="http://hcysun.me&#9">aaaa</a>

	注意，只有在 chrome 浏览器下才能获得如上效果，可以发现，在获取的内容中换行符和制表符分别被转换成了 &#10 和 &#9。
	实际上，这算是浏览器的怪癖行为。在 IE 中，不仅仅是 a 标签的 href 属性值，任何属性值都存在这个问题。
	这就会影响 Vue 的编译器在对模板进行编译后的结果，导致莫名奇妙的问题，
	为了避免这些问题 Vue 需要知道什么时候要做兼容工作，这就是 shouldDecodeNewlines 的变量的作用。


	最终如果 shouldDecodeNewlines 为 true，意味着 Vue 在编译模板的时候，要对属性值中的换行符做兼容处理！！！！！！
*/