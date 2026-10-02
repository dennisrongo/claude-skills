const opts = SPEC.options
const W = 320
const GAP = 40
const ROW_GAP = 16
const top = head('Options')

const picked = opts.findIndex((o) => clean(o.name).toLowerCase() === clean(SPEC.recommended || '').toLowerCase())
const titles = opts.map((o, i) => `${i + 1} · ${clean(o.name)}${i === picked ? ' (recommended)' : ''}`)
const inc = opts.map((o) => 'Includes\n' + bullets(o.includes))
const pro = opts.map((o) => 'Pros\n' + bullets(o.pros))
const con = opts.map((o) => 'Cons\n' + bullets(o.cons))
const tall = (list, size) => Math.max(...list.map((t) => fit(t, W, size)))
const hT = tall(titles, 'm')
const hI = tall(inc, 's')
const hP = tall(pro, 's')
const hC = tall(con, 's')

opts.forEach((o, i) => {
  const x = i * (W + GAP)
  let y = top
  box(x, y, W, hT, titles[i], { color: i === picked ? 'violet' : 'blue', size: 'm', verticalAlign: 'middle' })
  y += hT + ROW_GAP
  box(x, y, W, hI, inc[i], { color: 'grey' })
  y += hI + ROW_GAP
  box(x, y, W, hP, pro[i], { color: 'green' })
  y += hP + ROW_GAP
  box(x, y, W, hC, con[i], { color: 'red' })
})

return complete({ layout: 'columns', options: opts.length })
