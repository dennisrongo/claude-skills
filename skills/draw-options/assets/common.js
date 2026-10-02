const { toRichText, createShapeId } = await import('tldraw')

const CHAR = { s: 9.5, m: 11.5 }
const LINE = { s: 24, m: 30 }
const PAD = 32
const SLACK = 8
const WRAP = 0.9

const clean = (v) => String(v).replace(/\s+/g, ' ').trim()
const bullets = (items) => (items || []).map((i) => '• ' + clean(i)).join('\n')

const fit = (text, w, size = 's') => {
  const perLine = Math.max(1, Math.floor(((w - PAD) / CHAR[size]) * WRAP))
  const lines = String(text)
    .split('\n')
    .reduce((n, p) => n + Math.max(1, Math.ceil(p.length / perLine)), 0)
  return lines * LINE[size] + PAD + SLACK
}

const made = []
const add = (partial) => {
  const id = createShapeId()
  editor.createShape({ id, ...partial })
  made.push(id)
  return id
}
const box = (x, y, w, h, text, o = {}) =>
  add({
    type: 'geo',
    x,
    y,
    props: { geo: 'rectangle', w, h, richText: toRichText(text), size: 's', align: 'start', verticalAlign: 'start', fill: 'semi', ...o },
  })
const heading = (x, y, text) => add({ type: 'text', x, y, props: { richText: toRichText(text), size: 'xl', autoSize: true } })
const caption = (x, y, text) => add({ type: 'text', x, y, props: { richText: toRichText(text), size: 's', autoSize: true } })

const existing = editor.getCurrentPageShapes()
const startY = existing.length ? Math.max(...existing.map((s) => editor.getShapePageBounds(s.id)?.maxY ?? 0)) + 140 : 0

const head = (label) => {
  heading(0, startY, `${label} · ${clean(SPEC.title)}`)
  if (SPEC.question) caption(0, startY + 66, clean(SPEC.question))
  return startY + 120
}

const shapeKey = (id) => (id.startsWith('shape:') ? id : 'shape:' + id)
const ownLints = () => {
  const mine = new Set(made)
  return helpers.getLints().lints.filter((l) => l.shapeIds.some((id) => mine.has(shapeKey(id))))
}

const complete = (extra = {}) => {
  const growIds = (lints) => [...new Set(lints.filter((l) => l.type === 'growY-on-shape').flatMap((l) => l.shapeIds))]
  let lints = ownLints()
  const grown = growIds(lints)
  if (grown.length) {
    const updates = grown.map((raw) => {
      const s = editor.getShape(shapeKey(raw))
      return { id: s.id, type: s.type, props: { h: s.props.h + s.props.growY, growY: 0 } }
    })
    editor.updateShapes(updates)
    lints = ownLints()
  }
  if (lints.length) {
    throw new Error('layout lints remain (shorten the longest label or cell and rerun): ' + JSON.stringify(lints.map((l) => `${l.type}: ${l.message}`)))
  }
  return { shapes: made.length, lints: 0, grownFixed: grown.length, ...extra }
}
