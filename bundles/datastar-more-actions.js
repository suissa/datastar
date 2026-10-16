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
  const sockets = new WeakMap();
  const renderers = new WeakMap();

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

    // The page remains at /; only the WebSocket handshake has its own endpoint.
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = new URL(scheme + '//' + window.location.host + '/ws');
    socketUrl.searchParams.set('channel', channel);
    const socket = new WebSocket(socketUrl);
    sockets.set(el, socket);

    const setStatus = (text, state) => {
      if (status) status.textContent = text;
      if (indicator) {
        indicator.classList.remove('bg-amber-400', 'bg-emerald-400', 'bg-red-400');
        indicator.classList.add(state === 'connected' ? 'bg-emerald-400' : state === 'error' ? 'bg-red-400' : 'bg-amber-400');
      }
    };
    const appendMessage = (text, kind = 'assistant') => {
      const line = document.createElement('div');
      if (kind === 'system') {
        line.className = 'mx-auto my-3 max-w-fit rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400';
      } else if (kind === 'user') {
        line.className = 'ml-auto mb-3 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#303030] px-4 py-3 text-sm text-white';
      } else {
        line.className = 'mr-auto mb-3 max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-slate-100';
      }
      line.textContent = text;
      output.append(line);
      output.scrollTop = output.scrollHeight;
    };
    renderers.set(el, appendMessage);

    socket.addEventListener('open', () => setStatus('Conectado', 'connected'));
    socket.addEventListener('close', () => setStatus('Desconectado', 'idle'));
    socket.addEventListener('error', () => setStatus('Erro de conexão', 'error'));
    socket.addEventListener('message', (event) => {
      let payload = event.data;
      try { payload = JSON.parse(String(event.data)); } catch { /* plain text */ }
      const text = typeof payload === 'string' ? payload : payload?.text;
      if (typeof text === 'string' && text.length) {
        const role = payload?.role || (text.startsWith('Connected to #') ? 'system' : 'assistant');
        appendMessage(text, role === 'user' ? 'user' : role === 'system' ? 'system' : 'assistant');
      }
      el.dispatchEvent(new CustomEvent('datastar:ws-message', { detail: payload }));
    });

    const cleanup = () => {
      connected.delete(el);
      cleanups.delete(el);
      sockets.delete(el);
      renderers.delete(el);
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
    const candidates = [];
    if (root.nodeType === Node.ELEMENT_NODE) candidates.push(root);
    root.querySelectorAll?.('*').forEach((el) => candidates.push(el));
    for (const el of candidates) {
      if (el.hasAttribute('data-on:load') || el.hasAttribute('data-on-load')) {
        runLoadAction(el);
      }
    }
  }

  // Capture submit before any framework/bubbling handler. This prevents the
  // browser's default GET navigation even if the load action was not initialized.
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const el = form.closest('[data-component="chat"]');
    if (!el || (!el.hasAttribute('data-on:load') && !el.hasAttribute('data-on-load'))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = form.querySelector('[name="message"]');
    const text = input?.value?.trim();
    const socket = sockets.get(el);
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    renderers.get(el)?.(text, 'user');
    socket.send(JSON.stringify({ type: 'message', text, role: 'user' }));
    input.value = '';
    input.focus();
  }, true);

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
