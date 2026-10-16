import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import { CopilotRuntime, BuiltInAgent, createCopilotRuntimeHandler } from '@copilotkit/runtime/v2'
import { createCopilotNodeHandler } from '@copilotkit/runtime/v2/node'

const port = Number(process.env.PORT || 3000)
const exampleDir = fileURLToPath(new URL('./', import.meta.url))
const repoRoot = resolve(exampleDir, '../..')

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

// CopilotKit v2 runtime with A2UI middleware enabled. The WebSocket bridge below
// keeps the existing chat transport and maps generated content to the fixed chat catalog.
const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: process.env.COPILOTKIT_MODEL || 'openai/gpt-4o-mini',
      prompt: 'You generate concise Portuguese UI copy for a chat demo. Reply with only the text to display, without Markdown, HTML, JSON, or instructions. Never choose component types; the server controls the component catalog.'
    })
  },
  a2ui: {}
})
const copilotFetchHandler = createCopilotRuntimeHandler({ runtime: copilotRuntime, basePath: '/api/copilotkit' })
const copilotNodeHandler = createCopilotNodeHandler(copilotFetchHandler)

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api/copilotkit')) {
    return copilotNodeHandler(req, res)
  }
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

function actionPrompt(action) {
  const prompts = {
    'show-card': 'Crie o texto curto de um cartão de boas-vindas para a demonstração A2UI.',
    'show-status': 'Crie uma mensagem curta de status indicando que o servidor de demonstração está respondendo.',
    'show-metric': 'Crie uma métrica demonstrativa simples para o chat, sem inventar dados reais.',
    'show-text': 'Crie uma confirmação curta de que o servidor recebeu o clique.'
  }
  return prompts[action]
}

async function generateComponentText(action) {
  // Keep the deterministic demo working without API credentials. When configured,
  // the same WebSocket action invokes the CopilotKit runtime and uses its answer.
  if (!process.env.OPENAI_API_KEY) return null
  const response = await fetch(`http://127.0.0.1:${port}/api/copilotkit/agent/default/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({
      threadId: 'datastar-chat',
      runId: randomUUID(),
      state: {},
      messages: [{ id: randomUUID(), role: 'user', content: actionPrompt(action) }],
      tools: [],
      context: [],
      forwardedProps: {}
    })
  })
  if (!response.ok || !response.body) throw new Error(`CopilotKit runtime returned HTTP ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let generated = ''
  const consume = (frame) => {
    const data = frame.split('\\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\\n')
    if (!data || data === '[DONE]') return
    try {
      const event = JSON.parse(data)
      if (event.type === 'TEXT_MESSAGE_CONTENT' && typeof event.delta === 'string') generated += event.delta
      else if (event.type === 'TEXT_MESSAGE_END' && typeof event.content === 'string' && !generated) generated = event.content
    } catch { /* Ignore SSE comments and non-JSON frames. */ }
  }
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const frames = buffer.split(/\\r?\\n\\r?\\n/)
    buffer = frames.pop() || ''
    for (const frame of frames) consume(frame)
    if (done) break
  }
  if (buffer.trim()) consume(buffer)
  return generated.trim().slice(0, 500) || null
}

async function sendA2UIAction(ws, payload) {
  if (payload?.catalog !== 'chat' || typeof payload.action !== 'string') return
  if (payload.surfaceId !== 'chat' || ws.readyState !== WebSocket.OPEN) return
  const allowedComponent = a2uiCatalogs.chat[payload.action]
  if (!allowedComponent) return

  let text = allowedComponent.text
  try {
    text = (await generateComponentText(payload.action)) || text
  } catch (error) {
    console.error('CopilotKit generation failed; using the safe demo response:', error?.message || error)
  }
  if (ws.readyState !== WebSocket.OPEN) return

  // Component type and catalog remain server-controlled even when text comes from an LLM.
  ws.send(JSON.stringify({
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'chat',
      components: [{ id: 'root', component: 'Text', text, variant: allowedComponent.variant || 'body' }]
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
      void sendA2UIAction(ws, payload)
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
