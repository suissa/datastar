/**
 * Datastar A2UI bridge — A2UI protocol v0.9.
 *
 * The data-a2ui attribute selects an allowlisted component catalog.
 * A2UI messages travel over the WebSocket opened by datastar-more-actions.js.
 */
(() => {
  'use strict';

  const catalogs = Object.freeze({
    chat: {
      catalogId: 'https://datastar.local/a2ui/catalogs/chat',
      components: new Set(['Text', 'Divider'])
    }
  });
  const surfaces = new WeakMap();

  function safeText(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (value && typeof value === 'object' && typeof value.literalString === 'string') return value.literalString;
    return '';
  }

  function renderComponent(surface, component, allowed) {
    if (!component || typeof component !== 'object' || !allowed.has(component.component)) return null;
    if (component.id !== 'root') return null;

    if (component.component === 'Text') {
      const variant = ['h1', 'h2', 'h3'].includes(component.variant) ? component.variant : 'body';
      const tag = ({ h1: 'h2', h2: 'h3', h3: 'h4', body: 'p' })[variant];
      const classes = variant === 'body'
        ? 'text-sm leading-6 text-gray-200'
        : 'text-base font-semibold text-white';
      const node = document.createElement(tag);
      node.className = classes;
      node.textContent = safeText(component.text);
      return node;
    }

    if (component.component === 'Divider') {
      const node = document.createElement('hr');
      node.className = 'my-2 border-white/10';
      return node;
    }
    return null;
  }

  function initialize(root) {
    const candidates = [];
    if (root instanceof Element && root.matches('[data-a2ui]')) candidates.push(root);
    root.querySelectorAll?.('[data-a2ui]').forEach((node) => candidates.push(node));

    for (const host of candidates) {
      if (surfaces.has(host)) continue;
      const catalogName = host.dataset.a2ui;
      const catalog = catalogs[catalogName];
      const surfaceNode = host.querySelector('[data-a2ui-surface]');
      if (!catalog || !surfaceNode) continue;

      const state = { surfaceId: null, created: false };
      const onMessage = (event) => {
        const payload = event.detail;
        if (!payload || typeof payload !== 'object') return;

        if (payload.createSurface) {
          const message = payload.createSurface;
          if (payload.version !== 'v0.9' || message.catalogId !== catalog.catalogId) return;
          state.surfaceId = message.surfaceId;
          state.created = true;
          return;
        }

        if (payload.updateComponents) {
          const update = payload.updateComponents;
          if (payload.version !== 'v0.9' || !state.created || update.surfaceId !== state.surfaceId) return;
          for (const component of update.components || []) {
            const node = renderComponent(surfaceNode, component, catalog.components);
            if (!node) continue;
            if (component.id === 'root') surfaceNode.replaceChildren(node);
            else surfaceNode.append(node);
          }
        }
      };

      const onClick = (event) => {
        const button = event.target.closest('[data-a2ui-request], [data-a2ui-action]');
        if (!button || !host.contains(button)) return;
        const action = button.dataset.a2uiRequest || button.dataset.a2uiAction;
        if (!action || !state.created) return;
        host.dispatchEvent(new CustomEvent('datastar:ws-send', {
          detail: { type: 'a2ui-action', catalog: catalogName, action, surfaceId: state.surfaceId }
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
        surfaces.get(node)?.();
        node.querySelectorAll?.('[data-a2ui]').forEach((child) => surfaces.get(child)?.());
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
