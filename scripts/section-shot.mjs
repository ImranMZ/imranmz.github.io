// Screenshots a single section by CSS selector, at a chosen width.
//
//   node scripts\section-shot.mjs <url> <selector> <outFile> [width] [height]
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { withPage } from './cdp.mjs'

const [url, selector, outFile, w = '390', h = '844'] = process.argv.slice(2)
const width = Number(w)
const height = Number(h)

// Captures the viewport after scrolling the section into view. Deliberately
// avoids captureBeyondViewport: at desktop widths a full-page bitmap with
// deviceScaleFactor 2 runs to tens of millions of pixels and the capture hangs.
const { data } = await withPage(url, { width, height, port: 9400 + Math.floor(Math.random() * 90) }, async ({ send, evaluate }) => {
  await evaluate(`(() => {
    const style = document.createElement('style')
    style.textContent =
      '*,*::before,*::after{animation:none !important;transition:none !important}html{scroll-behavior:auto !important}'
    document.head.appendChild(style)
    document.querySelectorAll('.scroll-reveal').forEach((el) => el.classList.add('visible'))
    return true
  })()`)

  const found = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    el.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -70)
    return true
  })()`)
  if (!found) throw new Error(`selector not found: ${selector}`)
  // Let the (now instant) scroll commit before the compositor snapshots.
  await evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')

  // No clip: with a clip, CDP expects page-space coordinates, which is not what
// we want here. Omitting it captures the current viewport, which is exactly the
// scrolled-to section.
const shot = await send('Page.captureScreenshot', { format: 'png' })
  return shot.result
})

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, Buffer.from(data, 'base64'))
console.log(`${selector} -> ${outFile}`)
process.exit(0)