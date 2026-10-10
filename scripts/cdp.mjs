// Shared headless-Chrome DevTools helper. No external dependencies: Node's
// built-in WebSocket talks to Chrome directly.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

export async function withPage(url, { width = 390, height = 844, port = 9340 } = {}, fn) {
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  const kill = () => {
    try {
      chrome.kill()
    } catch {}
  }
  process.on('exit', kill)

  let wsUrl
  for (let i = 0; i < 60 && !wsUrl; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl
    } catch {}
    if (!wsUrl) await sleep(250)
  }
  if (!wsUrl) {
    kill()
    throw new Error('Chrome DevTools endpoint never came up')
  }

  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  let id = 0
  const pending = new Map()
  const events = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    } else if (msg.method && events.has(msg.method)) {
      events.get(msg.method)()
      events.delete(msg.method)
    }
  })

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id
      pending.set(n, resolve)
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  const once = (method, timeout = 15000) =>
    new Promise((resolve) => {
      events.set(method, resolve)
      setTimeout(resolve, timeout)
    })

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.result?.exceptionDetails) {
      throw new Error(res.result.exceptionDetails.exception?.description || 'eval failed')
    }
    return res.result?.result?.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: true,
  })

  const loaded = once('Page.loadEventFired')
  await send('Page.navigate', { url })
  await loaded
  // Give webfonts and scroll-reveal observers a moment to settle.
  await evaluate('document.fonts ? document.fonts.ready.then(() => true) : true')
  await sleep(600)

  try {
    return await fn({ evaluate, send })
  } finally {
    ws.close()
    kill()
  }
}