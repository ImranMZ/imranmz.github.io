// Full-page screenshots at real device metrics, via CDP.
//
//   node scripts\screenshot.mjs [url] [outDir] [width] [height]
//
// Uses device emulation on purpose: Chrome's --window-size flag does not emulate
// a mobile viewport, which previously produced screenshots that misrepresented
// the layout.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { withPage } from './cdp.mjs'

const url = process.argv[2] || 'http://localhost:4321/'
const outDir = process.argv[3] || join(tmpdir(), 'opencode', 'shots')
const only = process.argv[4]

mkdirSync(outDir, { recursive: true })

const sizes = [
  ['360x800', 360, 800],
  ['390x844', 390, 844],
  ['768x1024', 768, 1024],
  ['1280x900', 1280, 900],
].filter(([label]) => !only || label === only)

for (const [label, width, height] of sizes) {
  const { data } = await withPage(url, { width, height, port: 9350 + width }, async ({ send, evaluate }) => {
    // Freeze animations: the looping orbs keep the compositor busy, and
    // captureScreenshot waits for a settled frame — without this, tall pages
    // never resolve and the capture hangs.
    await evaluate(`(() => {
      const style = document.createElement('style')
      style.textContent = '*,*::before,*::after{animation:none !important;transition:none !important}'
      document.head.appendChild(style)
      document.querySelectorAll('.scroll-reveal').forEach((el) => el.classList.add('visible'))
      return true
    })()`)
    const metrics = await send('Page.getLayoutMetrics')
    const h = Math.min(Math.ceil(metrics.result.cssContentSize.height), 8000)
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: h, scale: 1 },
    })
    return shot.result
  })
  const file = join(outDir, `${label}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`${label} -> ${file}`)
}
process.exit(0)