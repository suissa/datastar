import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

const port = Number(process.env.PORT || 3000)
const exampleDir = fileURLToPath(new URL('./', import.meta.url))
const repoRoot = resolve(exampleDir, '../..')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname === '/') {
    const html = await readFile(resolve(exampleDir, 'index.html'))
    res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' })
    res.end(html)
    return
  }
  if (url.pathname === '/bundles/datastar-more-actions.js') {
    try {
      const script = await readFile(resolve(repoRoot, 'bundles/datastar-more-actions.js'))
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' })
      res.end(script)
    } catch {
      res.writeHead(404); res.end('Bundle not found')
    }
    return
  }
  res.writeHead(404); res.end('Not found')
})

const wss = new WebSocketServer({ noServer: true })
const channels = new Map()

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname !== '/ws' || !url.searchParams.get('channel')) {
    socket.write('HTTP/1.1 404 Not Found\\r\\nConnection: close\\r\\n\\r\\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.channel = url.searchParams.get('channel')
    wss.emit('connection', ws, req)
  })
})

function createReply(text) {
  if (/capital do brasil/i.test(text)) {
    return 'A capital do Brasil é Brasília.'
  }
  if (/2\\s*\\+\\s*2|quanto é quatro/i.test(text)) {
    return '2 + 2 = 4.'
  }
  const echoed = text.match(/repita minha mensagem:\\s*(.*)/i)
  if (echoed) {
    return `Você pediu para repetir: “${echoed[1]}”. Recebi sua mensagem pelo WebSocket.`
  }
  return `Entendi sua mensagem: “${text}”. Esta resposta foi gerada pelo servidor de demonstração.`
}

wss.on('connection', (ws) => {
  const channel = ws.channel
  if (!channels.has(channel)) channels.set(channel, new Set())
  channels.get(channel).add(ws)
  ws.send(JSON.stringify({ type: 'message', text: `Connected to #${channel}`, role: 'system' }))

  ws.on('message', (raw) => {
    let payload
    try { payload = JSON.parse(raw.toString()) } catch { return }
    if (payload?.type !== 'message' || typeof payload.text !== 'string') return
    const text = payload.text.trim().slice(0, 2000)
    if (!text) return

    const reply = createReply(text)
    const frame = JSON.stringify({ type: 'message', text: reply, role: 'assistant' })
    setTimeout(() => {
      for (const client of channels.get(channel) || []) {
        if (client.readyState === WebSocket.OPEN) client.send(frame)
      }
    }, 350)
  })

  ws.on('close', () => {
    const members = channels.get(channel)
    members?.delete(ws)
    if (members?.size === 0) channels.delete(channel)
  })
})

server.listen(port, () => console.log(`WebSocket chat at http://localhost:${port}`))
