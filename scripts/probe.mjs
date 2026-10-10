// Reports layout problems at a phone viewport: horizontal overflow (rect-based),
// text overflowing its own box (scrollWidth-based), and general page state.
//
//   node scripts\probe.mjs [url] [width] [height]
import { withPage } from './cdp.mjs'

const url = process.argv[2] || 'http://localhost:4321/'
const width = Number(process.argv[3] || 390)
const height = Number(process.argv[4] || 844)
const drillSel = process.env.DRILL || '#contact'

const r = await withPage(url, { width, height, port: 9600 + Math.floor(Math.random() * 300) }, async ({ evaluate }) => {
  return evaluate(`(() => {
    const vw = window.innerWidth
    const label = (el) => {
      const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 5).join('.')
      return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '')
    }

    const rectOffenders = []
    const textOffenders = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.right > vw + 1 || r.left < -1) {
        rectOffenders.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) })
      }
      const over = el.scrollWidth - el.clientWidth
      if (over > 1) {
        const cs = getComputedStyle(el)
        textOffenders.push({
          el: label(el),
          overBy: over,
          overflowX: cs.overflowX,
          clipped: cs.overflowX === 'hidden' || cs.overflowX === 'clip',
        })
      }
    }

    const h1 = document.querySelector('h1')
    const nav = document.querySelector('nav')
    const measure = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        fontSize: getComputedStyle(el).fontSize,
        boxWidth: Math.round(r.width),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }
    }

    // scrollWidth misses text that spills out of its own box, so measure the
    // rendered glyph run with a Range instead.
    const textWidth = (el) => {
      if (!el) return null
      const range = document.createRange()
      range.selectNodeContents(el)
      const w = range.getBoundingClientRect().width
      const box = el.getBoundingClientRect().width
      return {
        textWidth: Math.round(w),
        boxWidth: Math.round(box),
        spillsBy: Math.round(w - box),
        clippedByBodyOverflow: w > box && getComputedStyle(document.body).overflowX === 'hidden',
      }
    }

    const heroBits = [...document.querySelectorAll('#hero h1, #hero p')].map((el) => ({
      el: el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(/\\s+/).slice(0, 2).join('.'),
      ...textWidth(el),
    }))

    // Drill into a chosen container to find what is too wide inside it.
    const drill = (sel) => {
      const scope = document.querySelector(sel)
      if (!scope) return []
      const sr = scope.getBoundingClientRect()
      return [...scope.querySelectorAll('*')]
        .map((el) => {
          const r = el.getBoundingClientRect()
          return {
            el: label(el),
            w: Math.round(r.width),
            left: Math.round(r.left),
            right: Math.round(r.right),
            pastRight: Math.round(r.right - sr.right),
            pastLeft: Math.round(sr.left - r.left),
            scrollOver: el.scrollWidth - el.clientWidth,
          }
        })
        .filter((x) => x.pastRight > 1 || x.pastLeft > 1 || x.scrollOver > 1)
        .slice(0, 12)
    }

    return {
      state: {
        href: location.href,
        title: document.title,
        stylesheets: document.styleSheets.length,
      },
      viewport: { innerWidth: vw, clientWidth: document.documentElement.clientWidth, pageHeight: document.documentElement.scrollHeight },
      scroll: {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
        htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      },
      hero: measure(h1),
      nav: measure(nav),
      heroText: heroBits,
      contactDrill: drill(${JSON.stringify(drillSel)}),
      rectOffenders: rectOffenders.slice(0, 20),
      rectTotal: rectOffenders.length,
      textOffenders: textOffenders.slice(0, 20),
      textTotal: textOffenders.length,
    }
  })()`)
})

const lines = []
const p = (s = '') => lines.push(s)

p(`viewport ${width}x${height}`)
p(`  page height    ${r.viewport.pageHeight}px (${Math.round(r.viewport.pageHeight / 844)} screens)`)
p(`  innerWidth      ${r.viewport.innerWidth}`)
p(`  clientWidth     ${r.viewport.clientWidth}`)
p(`  docScrollWidth  ${r.scroll.docScrollWidth}   ${r.scroll.docScrollWidth > r.viewport.clientWidth ? '<-- PAGE SCROLLS SIDEWAYS' : 'ok'}`)
p(`  body overflow-x ${r.scroll.bodyOverflowX} / html ${r.scroll.htmlOverflowX}`)
p('')
p(`hero h1  ${r.hero?.fontSize}  box ${r.hero?.boxWidth}px`)
p(`nav      box ${r.nav?.boxWidth}px  content ${r.nav?.scrollWidth}px  ${r.nav && r.nav.scrollWidth - r.nav.clientWidth > 1 ? `<-- overflows by ${r.nav.scrollWidth - r.nav.clientWidth}px` : 'ok'}`)
p('')
p(`hero text (glyph run vs box):`)
for (const b of r.heroText) p(`  ${b.spillsBy > 0 ? 'SPILLS' : 'fits '} ${String(b.spillsBy).padStart(5)}px  ${b.el}`)
p('')
p(`rect offenders: ${r.rectTotal}`)
for (const o of r.rectOffenders) p(`  ${o.left}..${o.right}  ${o.el}`)
p('')
p(`self-scrolling boxes: ${r.textTotal}`)
for (const o of r.textOffenders) p(`  +${o.overBy}px ${o.clipped ? '(clipped)' : '(scrolls)'}  ${o.el}`)
if (r.contactDrill?.length) {
  p('')
  p(`drill ${process.env.DRILL || '#contact'}:`)
  for (const d of r.contactDrill) p(`  ${d.left}..${d.right} w=${d.w}  pastR=${d.pastRight} pastL=${d.pastLeft} scroll+${d.scrollOver}  ${d.el}`)
}
console.log(lines.join('\n'))
process.exit(0)