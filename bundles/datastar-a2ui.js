/**
 * Datastar A2UI bridge.
 *
 * Uses the chat component's existing WebSocket; it never opens a second socket.
 * The data-a2ui attribute selects a local, allowlisted component catalog.
 */
(() => {
  'use strict';

  const catalogs = Object.freeze({
    chat: new Set(['text', 'card', 'badge', 'metric', 'button'])
  });
  const surfaces = new WeakMap();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function renderComponent(host, component, catalogName) {
    if (!component || typeof component !== 'object' || Array.isArray(component)) return;
    const allowed = catalogs[catalogName];
    if (!allowed || !allowed.has(component.type)) return;

    let node;
    switch (component.type) {
      case 'text':
        node = element('p', 'text-sm leading-6 text-gray-200', component.text || '');
        break;
      case 'badge':
        node = element('span', 'inline-flex w-fit rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100', component.label || '');
        break;
      case 'metric': {
        node = element('section', 'rounded-2xl border border-white/10 bg-white/5 p-4');
        node.append(element('p', 'text-xs text-gray-400', component.label || 'Métrica'));
        node.append(element('p', 'mt-1 text-2xl font-semibold text-white', component.value ?? '—'));
        if (component.detail) node.append(element('p', 'mt-1 text-xs text-gray-400', component.detail));
        break;
      }
      case 'card': {
        node = element('section', 'rounded-2xl border border-white/10 bg-[#292929] p-4');
        if (component.title) node.append(element('h3', 'text-sm font-semibold text-white', component.title));
        if (component.text) node.append(element('p', 'mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300', component.text));
        if (component.action && typeof component.action === 'string' && component.actionLabel) {
          const button = element('button', 'mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white transition hover:bg-white/10', component.actionLabel);
          button.type = 'button';
          button.dataset.a2uiAction = component.action;
          node.append(button);
        }
        break;
      }
      case 'button':
        node = element('button', 'w-fit rounded-xl border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-500/20', component.label || 'Continuar');
        node.type = 'button';
        if (typeof component.action === 'string') node.dataset.a2uiAction = component.action;
        else node.disabled = true;
        break;
      default:
        return;
    }

    node.dataset.a2uiComponent = component.type;
    host.append(node);
    host.scrollTop = host.scrollHeight;
  }

  function initialize(root) {
    const candidates = [];
    if (root instanceof Element && root.matches('[data-a2ui]')) candidates.push(root);
    root.querySelectorAll?.('[data-a2ui]').forEach((node) => candidates.push(node));

    for (const host of candidates) {
      if (surfaces.has(host)) continue;
      const catalogName = host.dataset.a2ui;
      if (!catalogs[catalogName]) continue;
      const surface = host.querySelector('[data-a2ui-surface]');
      if (!surface) continue;

      const onMessage = (event) => {
        const payload = event.detail;
        if (!payload || payload.type !== 'a2ui-component' || payload.catalog !== catalogName) return;
        renderComponent(surface, payload.component, catalogName);
      };
      const onClick = (event) => {
        const button = event.target.closest('[data-a2ui-request], [data-a2ui-action]');
        if (!button || !host.contains(button)) return;
        const action = button.dataset.a2uiRequest || button.dataset.a2uiAction;
        if (!action) return;
        host.dispatchEvent(new CustomEvent('datastar:ws-send', {
          detail: { type: 'a2ui-action', catalog: catalogName, action }
        }));
      };
      host.addEventListener('datastar:ws-message', onMessage);
      host.addEventListener('click', onClick);
      surfaces.set(host, () => {
        host.removeEventListener('datastar:ws-message', onMessage);
        host.removeEventListener('click', onClick);
        surfaces.delete(host);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(document), { once: true });
  } else {
    initialize(document);
  }

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) initialize(node);
      }
      for (const node of record.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const cleanup = (el) => {
          surfaces.get(el)?.();
          el.querySelectorAll?.('[data-a2ui]').forEach((child) => surfaces.get(child)?.());
        };
        cleanup(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
