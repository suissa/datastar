// Icon: material-symbols:lan
// Slug: Connects an element to a named WebSocket channel.
// Description: Opens a WebSocket for an element and closes it when the element is removed.

import { action } from '@engine'

/**
 * Connects the invoking element to a named channel.
 * The server protocol uses JSON frames: { type: 'message', text: string }.
 * A chat form may be placed inside the element; submitted text is sent to the channel.
 */
action({
  name: 'ws',
  apply({ el, error, cleanups }, channel: string, options: { url?: string } = {}) {
    if (typeof channel !== 'string' || !channel.trim()) {
      throw error('WebSocketChannelRequired', { channel })
    }

    const configuredUrl = options.url
    const url = configuredUrl
      ? new URL(configuredUrl, document.baseURI)
      : new URL('/ws', document.baseURI)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('channel', channel)

    const socket = new WebSocket(url)
    const cleanupName = `@ws:${channel}`
    let closed = false

    const onMessage = (event: MessageEvent) => {
      let message: any = event.data
      try { message = JSON.parse(String(event.data)) } catch { /* plain text frame */ }
      const text = typeof message === 'string' ? message : message?.text
      if (typeof text !== 'string') {
        el.dispatchEvent(new CustomEvent('datastar:ws-message', { detail: message }))
        return
      }

      // Use DOM text APIs rather than HTML parsing to keep remote messages inert.
      let output = el.querySelector<HTMLElement>('[data-ws-messages]')
      if (!output) {
        output = document.createElement('div')
        output.dataset.wsMessages = ''
        el.append(output)
      }
      const line = document.createElement('p')
      line.textContent = text
      output.append(line)
      el.dispatchEvent(new CustomEvent('datastar:ws-message', { detail: message }))
    }

    const onSubmit = (event: Event) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || !el.contains(form)) return
      const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="message"]')
      if (!input || !input.value.trim()) return
      event.preventDefault()
      if (socket.readyState !== WebSocket.OPEN) return
      socket.send(JSON.stringify({ type: 'message', text: input.value.trim() }))
      input.value = ''
    }

    socket.addEventListener('message', onMessage)
    el.addEventListener('submit', onSubmit)
    cleanups.get(cleanupName)?.()
    const cleanup = () => {
      if (closed) return
      closed = true
      socket.removeEventListener('message', onMessage)
      el.removeEventListener('submit', onSubmit)
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(1000, 'Element disconnected')
    }
    cleanups.set(cleanupName, cleanup)
    return cleanup
  },
})
