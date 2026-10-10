// Finds what actually widens the document: hides one candidate at a time and
// re-measures documentElement.scrollWidth. The culprit is the candidate whose
// removal brings the width back to the viewport.
//
//   node scripts\find-overflow-cause.mjs [url] [width] [height]
import { withPage } from './cdp.mjs'

const url = process.argv[2] || 'http://localhost:4321/'
const width = Number(process.argv[3] || 390)
const height = Number(process.argv[4] || 844)

const out = await withPage(url, { width, height }, async ({ evaluate }) => {
  return evaluate(`(() => {
    const vw = window.innerWidth
    const docW = () => document.documentElement.scrollWidth
    const base = docW()

    const candidates = [...document.querySelectorAll('body > *, section, section > div, nav, .orb, .tile, form, input, textarea')]
    const results = []

    for (const el of candidates) {
      const prev = el.style.display
      el.style.display = 'none'
      const after = docW()
      el.style.display = prev
      if (after < base) {
        results.push({
          el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + (el.getAttribute('class') || '').split(/\\s+/).slice(0, 3).join('.'),
          base,
          withoutIt: after,
          recovered: base - after,
        })
      }
    }

    results.sort((a, b) => b.recovered - a.recovered)
    return { viewport: vw, base, recoveredTo: Math.min(...results.map((r) => r.withoutIt), base), results: results.slice(0, 12) }
  })()`)
})

console.log(`viewport ${out.viewport}   docScrollWidth ${out.base}`)
if (!out.results.length) console.log('nothing recovered width when hidden')
for (const r of out.results) console.log(`  -${r.recovered}px (${r.base} -> ${r.withoutIt})  ${r.el}`)
process.exit(0)