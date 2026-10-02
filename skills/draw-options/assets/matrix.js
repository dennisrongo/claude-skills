const names = SPEC.options.map(clean)
const crit = SPEC.criteria
const GAP = 8
const CW = 220
const longest = Math.max(...crit.map((c) => clean(c.name).length), 'Criteria'.length)
const LW = Math.min(320, Math.max(200, Math.ceil((longest * CHAR.s) / WRAP) + PAD))
const top = head('Compare')

const widths = [LW, ...names.map(() => CW)]
const rows = [['Criteria', ...names], ...crit.map((c) => [clean(c.name), ...c.values.map(clean)])]

let y = top
rows.forEach((row, ri) => {
  const h = Math.max(...row.map((cell, ci) => fit(cell, widths[ci], 's')))
  let x = 0
  row.forEach((cell, ci) => {
    const header = ri === 0
    box(x, y, widths[ci], h, cell, {
      color: header ? 'blue' : ci === 0 ? 'grey' : 'light-blue',
      fill: header || ci === 0 ? 'semi' : 'none',
      verticalAlign: 'middle',
    })
    x += widths[ci] + GAP
  })
  y += h + GAP
})

if (SPEC.recommendation) {
  const total = widths.reduce((n, w) => n + w, 0) + GAP * (widths.length - 1)
  box(0, y + 16, total, fit(clean(SPEC.recommendation), total, 's'), clean(SPEC.recommendation), { color: 'green', verticalAlign: 'middle' })
}

return complete({ layout: 'matrix', options: names.length, criteria: crit.length })
