const ROOT = 'ds-tabs';
const LIST = 'ds-tabs-list';
const TRIGGER = 'ds-tabs-trigger';
const CONTENT = 'ds-tabs-content';

function parts(root, selector) {
  return [...root.querySelectorAll(selector)].filter((node) => node.closest(ROOT) === root);
}

class DatastarTabs extends HTMLElement {
  connectedCallback() {
    if (this._ready) return;
    this._ready = true;
    this.addEventListener('click', this._click);
    this.addEventListener('keydown', this._keydown);
    const triggers = parts(this, TRIGGER);
    const initial = this.getAttribute('value') || this.getAttribute('default-value');
    this.activate(triggers.find((node) => node.getAttribute('value') === initial) ||
      triggers.find((node) => !node.disabled && !node.hasAttribute('disabled')), false);
  }
  disconnectedCallback() {
    this.removeEventListener('click', this._click);
    this.removeEventListener('keydown', this._keydown);
    this._ready = false;
  }
  get orientation() { return this.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal'; }
  activate(trigger, emit = true) {
    if (!trigger || trigger.hasAttribute('disabled')) return;
    const value = trigger.getAttribute('value');
    this._value = value;
    this.setAttribute('data-orientation', this.orientation);
    for (const item of parts(this, TRIGGER)) {
      const selected = item === trigger;
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      item.toggleAttribute('data-state-active', selected);
      item.toggleAttribute('data-state-inactive', !selected);
      const panel = parts(this, CONTENT).find((p) => p.getAttribute('value') === item.getAttribute('value'));
      if (panel) {
        if (!panel.id) panel.id = `ds-tabpanel-${crypto.randomUUID()}`;
        if (!item.id) item.id = `ds-tab-${crypto.randomUUID()}`;
        item.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', item.id);
        panel.hidden = !selected;
        panel.toggleAttribute('data-state-active', selected);
        panel.toggleAttribute('data-state-inactive', !selected);
      }
    }
    const list = parts(this, LIST)[0];
    if (list) { list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', this.orientation); }
    if (emit) this.dispatchEvent(new CustomEvent('value-change', { bubbles: true, detail: { value } }));
  }
  _click = (event) => {
    const trigger = event.target.closest(TRIGGER);
    if (trigger && this.contains(trigger) && trigger.closest(ROOT) === this) this.activate(trigger);
  };
  _keydown = (event) => {
    const current = event.target.closest(TRIGGER);
    if (!current || current.closest(ROOT) !== this) return;
    const enabled = parts(this, TRIGGER).filter((t) => !t.hasAttribute('disabled'));
    const previous = this.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const next = this.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    let index = enabled.indexOf(current);
    if (event.key === previous) index = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === next) index = (index + 1) % enabled.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = enabled.length - 1;
    else return;
    event.preventDefault();
    enabled[index]?.focus();
    if (this.getAttribute('activation-mode') !== 'manual') this.activate(enabled[index]);
  };
}
if (!customElements.get(ROOT)) customElements.define(ROOT, DatastarTabs);
for (const tag of [LIST, TRIGGER, CONTENT]) {
  if (!customElements.get(tag)) customElements.define(tag, class extends HTMLElement {});
}
