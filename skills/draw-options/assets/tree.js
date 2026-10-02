const top = head('Decision tree')
const label = (v) => clean(v).replace(/"/g, "'").replace(/[<>`]/g, '')

const lines = ['flowchart TD', `  Q{"${label(SPEC.question || SPEC.title)}"}`]
SPEC.options.forEach((o, i) => {
  lines.push(`  Q --> O${i}["${label(o.name)}"]`)
  const leaves = [
    ...(o.pros || []).map((t) => 'Pro: ' + t),
    ...(o.cons || []).map((t) => 'Con: ' + t),
    ...(o.then || []).map((t) => 'Then: ' + t),
  ]
  leaves.forEach((t, j) => lines.push(`  O${i} --> O${i}_${j}["${label(t)}"]`))
})

const before = new Set(editor.getCurrentPageShapes().map((s) => s.id))
await helpers.mermaid(lines.join('\n'))
const added = editor.getCurrentPageShapes().filter((s) => !before.has(s.id))
const roots = added.filter((s) => s.parentId === editor.getCurrentPageId()).map((s) => s.id)
if (!roots.length) throw new Error('the diagram engine produced no shapes; nothing was drawn')
added.forEach((s) => made.push(s.id))

const bounds = roots.map((id) => editor.getShapePageBounds(id)).filter(Boolean)
const minX = Math.min(...bounds.map((b) => b.minX))
const minY = Math.min(...bounds.map((b) => b.minY))
helpers.translateShapes(roots, -minX, top - minY)

return complete({ layout: 'tree', options: SPEC.options.length })
