import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { WebSocketServer, WebSocket } from 'ws'

const port = Number(process.env.PORT || 3000)
const server = createServer(async (_req, res) => {
  try {
    const html = await readFile(new URL('./index.html', import.meta.url))
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  } catch {
    res.writeHead(500)
    res.end('Unable to load chat example')
  }
})
const wss = new WebSocketServer({ noServer: true })
const channels = new Map()

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname !== '/ws' || !url.searchParams.get('channel')) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.channel = url.searchParams.get('channel')
    wss.emit('connection', ws, req)
  })
})

wss.on('connection', (ws) => {
  const channel = ws.channel
  if (!channels.has(channel)) channels.set(channel, new Set())
  channels.get(channel).add(ws)
  ws.send(JSON.stringify({ type: 'message', text: `Connected to #${channel}` }))
  ws.on('message', (raw) => {
    let payload
    try { payload = JSON.parse(raw.toString()) } catch { return }
    if (payload?.type !== 'message' || typeof payload.text !== 'string') return
    const text = payload.text.trim().slice(0, 2000)
    if (!text) return
    const frame = JSON.stringify({ type: 'message', text })
    for (const client of channels.get(channel) || []) {
      if (client.readyState === WebSocket.OPEN) client.send(frame)
    }
  })
  ws.on('close', () => {
    const members = channels.get(channel)
    members?.delete(ws)
    if (members?.size === 0) channels.delete(channel)
  })
})

server.listen(port, () => console.log(`WebSocket chat at http://localhost:${port}`))
