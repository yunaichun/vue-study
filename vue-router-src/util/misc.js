/*浅拷贝：对象 b 混入到对象 a*/
export function extend (a, b) {
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
