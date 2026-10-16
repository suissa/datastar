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
  if (url.pathname === '/bundles/datastar-more-actions.js' || url.pathname === '/bundles/datastar-a2ui.js') {
    try {
      const filename = url.pathname.endsWith('datastar-a2ui.js') ? 'datastar-a2ui.js' : 'datastar-more-actions.js'
      const script = await readFile(resolve(repoRoot, 'bundles', filename))
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
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.channel = url.searchParams.get('channel')
    wss.emit('connection', ws, req)
  })
})

// A2UI v0.9 catalog allowlist: the browser selects "chat" with data-a2ui="chat".
// The server sends only components from this catalog, never client-supplied component JSON.
const A2UI_CATALOG_ID = 'https://datastar.local/a2ui/catalogs/chat'
const a2uiCatalogs = {
  chat: {
    'show-card': { component: 'Text', text: 'A2UI: este componente de texto foi enviado pelo servidor pelo WebSocket compartilhado.', variant: 'h2' },
    'show-status': { component: 'Text', text: 'Status do servidor: conectado e respondendo pelo mesmo canal #chat.', variant: 'body' },
    'show-metric': { component: 'Text', text: 'Métrica A2UI — mensagens processadas: 1.', variant: 'h3' },
    'show-text': { component: 'Text', text: 'Clique recebido. O servidor enviou exatamente um componente A2UI nesta resposta.', variant: 'body' }
  }
}

function sendA2UIAction(ws, payload) {
  if (payload?.catalog !== 'chat' || typeof payload.action !== 'string') return
  if (payload.surfaceId !== 'chat' || ws.readyState !== WebSocket.OPEN) return
  const component = a2uiCatalogs.chat[payload.action]
  if (!component) return

  ws.send(JSON.stringify({
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'chat',
      components: [{ id: 'root', ...component }]
    }
  }))
}

function createReply(text) {
  if (/capital do brasil/i.test(text)) {
    return 'A capital do Brasil é Brasília.'
  }
  if (/2\s*\+\s*2|quanto é quatro/i.test(text)) {
    return '2 + 2 = 4.'
  }
  const echoed = text.match(/repita minha mensagem:\s*(.*)/i)
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
  if (channel === 'chat') {
    ws.send(JSON.stringify({
      version: 'v0.9',
      createSurface: { surfaceId: 'chat', catalogId: A2UI_CATALOG_ID }
    }))
  }

  ws.on('message', (raw) => {
    let payload
    try { payload = JSON.parse(raw.toString()) } catch { return }
    if (payload?.type === 'a2ui-action') {
      sendA2UIAction(ws, payload)
      return
    }
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
