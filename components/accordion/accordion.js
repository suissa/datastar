const ROOT = 'ds-accordion';
const ITEM = 'ds-accordion-item';
const HEADER = 'ds-accordion-header';
const TRIGGER = 'ds-accordion-trigger';
const CONTENT = 'ds-accordion-content';

const directChildren = (root, selector) =>
  [...root.children].filter((child) => child.matches(selector));

function getItem(root, element) {
  return element.closest(ITEM)?.parentElement === root ? element.closest(ITEM) : null;
}

function itemValue(item) {
  return item?.getAttribute('value') ?? '';
}

function triggerFor(item) {
  return item && directChildren(item, TRIGGER)[0] ||
    item?.querySelector(TRIGGER);
}

function contentFor(item) {
  return item && directChildren(item, CONTENT)[0] ||
    item?.querySelector(CONTENT);
}

function itemsFor(root) {
  return [...root.querySelectorAll(ITEM)].filter((item) => getItem(root, item) === item);
}

function setPanelState(item, open) {
  const trigger = triggerFor(item);
  const content = contentFor(item);
  if (!trigger || !content) return;

  trigger.setAttribute('aria-expanded', String(open));
  trigger.toggleAttribute('data-state-open', open);
  trigger.toggleAttribute('data-state-closed', !open);
  content.hidden = !open;
  content.setAttribute('aria-hidden', String(!open));
  content.toggleAttribute('data-state-open', open);
  content.toggleAttribute('data-state-closed', !open);
}

function parseDefault(root) {
  const raw = root.getAttribute('default-value');
  if (raw == null || raw === '') return root.type === 'multiple' ? [] : '';
  return root.type === 'multiple' ? raw.split(',').map((value) => value.trim()).filter(Boolean) : raw;
}

class DatastarAccordion extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._value = this.hasAttribute('value') ? this.value : parseDefault(this);
    this.setAttribute('data-accordion', '');
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
    this.refresh();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
    this._initialized = false;
  }

  get type() {
    return this.getAttribute('type') === 'multiple' ? 'multiple' : 'single';
  }

  get value() {
    return this._value ?? (this.type === 'multiple' ? [] : '');
  }

  set value(nextValue) {
    this._value = this.type === 'multiple'
      ? [...new Set((Array.isArray(nextValue) ? nextValue : [nextValue]).filter(Boolean).map(String))]
      : String(nextValue ?? '');
    this.refresh();
  }

  refresh() {
    if (!this.isConnected) return;
    const values = this.type === 'multiple'
      ? new Set(Array.isArray(this._value) ? this._value : [])
      : new Set(this._value ? [this._value] : []);

    for (const item of itemsFor(this)) {
      const value = itemValue(item);
      const trigger = triggerFor(item);
      const content = contentFor(item);
      if (!trigger || !content) continue;

      const itemDisabled = this.hasAttribute('disabled') ||
        item.hasAttribute('disabled') || trigger.hasAttribute('disabled');
      item.toggleAttribute('data-disabled', itemDisabled);
      trigger.disabled = itemDisabled;
      if (!trigger.id) trigger.id = `ds-accordion-trigger-${crypto.randomUUID()}`;
      if (!content.id) content.id = `ds-accordion-content-${crypto.randomUUID()}`;
      trigger.setAttribute('aria-controls', content.id);
      content.setAttribute('aria-labelledby', trigger.id);
      content.setAttribute('role', 'region');
      setPanelState(item, values.has(value));
    }
  }

  _onClick = (event) => {
    const trigger = event.target.closest(TRIGGER);
    if (!trigger || !this.contains(trigger)) return;
    const item = getItem(this, trigger);
    if (!item || this.hasAttribute('disabled') || item.hasAttribute('disabled') || trigger.disabled) return;
    event.preventDefault();
    const value = itemValue(item);
    const current = this.value;
    if (this.type === 'multiple') {
      const next = new Set(current);
      next.has(value) ? next.delete(value) : next.add(value);
      this._commit([...next]);
      return;
    }
    if (current === value) {
      if (this.hasAttribute('collapsible')) this._commit('');
    } else {
      this._commit(value);
    }
  };

  _onKeyDown = (event) => {
    const trigger = event.target.closest(TRIGGER);
    if (!trigger || !this.contains(trigger)) return;
    const enabled = itemsFor(this).map(triggerFor).filter((button) =>
      button && !button.disabled && !button.closest(ITEM)?.hasAttribute('disabled'));
    if (!enabled.length) return;

    const orientation = this.getAttribute('orientation') === 'horizontal' ? 'horizontal' : 'vertical';
    const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    let index = enabled.indexOf(trigger);
    if (event.key === previousKey) index = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === nextKey) index = (index + 1) % enabled.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = enabled.length - 1;
    else return;

    event.preventDefault();
    enabled[index].focus();
  };

  _commit(nextValue) {
    this._value = nextValue;
    this.refresh();
    this.dispatchEvent(new CustomEvent('value-change', {
      bubbles: true,
      detail: { value: this.value },
    }));
  }
}

class DatastarAccordionItem extends HTMLElement {}
class DatastarAccordionHeader extends HTMLElement {}
class DatastarAccordionTrigger extends HTMLElement {}
class DatastarAccordionContent extends HTMLElement {}

if (!customElements.get(ROOT)) customElements.define(ROOT, DatastarAccordion);
if (!customElements.get(ITEM)) customElements.define(ITEM, DatastarAccordionItem);
if (!customElements.get(HEADER)) customElements.define(HEADER, DatastarAccordionHeader);
if (!customElements.get(TRIGGER)) {
  // Autonomous custom elements are used for broad browser compatibility.
  customElements.define(TRIGGER, class extends HTMLElement {
    connectedCallback() {
      if (this.tagName.toLowerCase() !== TRIGGER) return;
      this.setAttribute('role', 'button');
      if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.click();
        }
      });
    }
  });
}
if (!customElements.get(CONTENT)) customElements.define(CONTENT, DatastarAccordionContent);
