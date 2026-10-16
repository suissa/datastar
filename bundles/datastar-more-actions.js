/**
 * Datastar More Actions — standalone supplemental actions.
 *
 * Implements the missing `load` event bridge for `data-on:load` and the
 * `@ws('channel')` action without changing the browser's page URL.
 *
 * WebSocket traffic uses ws(s)://<current-host>/ws?channel=<channel>.
 */
(() => {
  'use strict';

  const connected = new WeakSet();
  const cleanups = new WeakMap();

  function connectElement(el, channel) {
    if (connected.has(el)) return;
    connected.add(el);

    const output = el.querySelector('[data-ws-messages]') || (() => {
      const node = document.createElement('div');
      node.dataset.wsMessages = '';
      node.setAttribute('aria-live', 'polite');
      el.append(node);
      return node;
    })();
    const status = el.querySelector('[data-ws-status]') || document.querySelector('[data-ws-status]');
    const indicator = status?.parentElement?.querySelector('[data-ws-indicator]');
    const form = el.querySelector('form');
    const input = form?.querySelector('[name="message"]');

    // The page remains at /; only the WebSocket handshake has its own endpoint.
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = new URL(scheme + '//' + window.location.host + '/ws');
    socketUrl.searchParams.set('channel', channel);
    const socket = new WebSocket(socketUrl);

    const setStatus = (text, state) => {
      if (status) status.textContent = text;
      if (indicator) {
        indicator.classList.remove('bg-amber-400', 'bg-emerald-400', 'bg-red-400');
        indicator.classList.add(state === 'connected' ? 'bg-emerald-400' : state === 'error' ? 'bg-red-400' : 'bg-amber-400');
      }
    };
    const appendMessage = (text, kind = 'message') => {
      const line = document.createElement('div');
      line.className = kind === 'system'
        ? 'mx-auto my-3 max-w-fit rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400'
        : 'mr-auto mb-3 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-slate-100';
      line.textContent = text;
      output.append(line);
      output.scrollTop = output.scrollHeight;
    };

    socket.addEventListener('open', () => setStatus('Conectado', 'connected'));
    socket.addEventListener('close', () => setStatus('Desconectado', 'idle'));
    socket.addEventListener('error', () => setStatus('Erro de conexão', 'error'));
    socket.addEventListener('message', (event) => {
      let payload = event.data;
      try { payload = JSON.parse(String(event.data)); } catch { /* plain text */ }
      const text = typeof payload === 'string' ? payload : payload?.text;
      if (typeof text === 'string' && text.length) {
        appendMessage(text, text.startsWith('Connected to #') ? 'system' : 'message');
      }
      el.dispatchEvent(new CustomEvent('datastar:ws-message', { detail: payload }));
    });

    const onSubmit = (event) => {
        // Always stop browser navigation, even while the socket is connecting.
        event.preventDefault();
        event.stopPropagation();
        const text = input?.value?.trim();
        if (!text || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type: 'message', text }));
        input.value = '';
        input.focus();
    };
    if (form) form.addEventListener('submit', onSubmit);

    const cleanup = () => {
      connected.delete(el);
      cleanups.delete(el);
      if (form) form.removeEventListener('submit', onSubmit);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Element removed');
      }
    };
    cleanups.set(el, cleanup);
  }

  function runLoadAction(el) {
    const expression = el.getAttribute('data-on:load')
      || el.getAttribute('data-on-load');
    if (!expression) return;
    const match = expression.trim().match(/^@ws\(\s*(['"])([^'"]+)\1\s*\)$/);
    if (!match) return;
    connectElement(el, match[2]);
  }

  function scan(root) {
    if (root.nodeType === Node.ELEMENT_NODE && root.matches('[data-on\\:load], [data-on-load]')) {
      runLoadAction(root);
    }
    root.querySelectorAll?.('[data-on\\:load], [data-on-load]').forEach(runLoadAction);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(document), { once: true });
  } else {
    scan(document);
  }

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const remove = (el) => {
          cleanups.get(el)?.();
          el.querySelectorAll?.('*').forEach((child) => cleanups.get(child)?.());
        };
        remove(node);
      }
      if (record.type === 'attributes' && record.target instanceof Element) {
        runLoadAction(record.target);
      }
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-on:load', 'data-on-load'],
  });
})();
