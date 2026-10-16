const TAG = 'ds-switch';
class DatastarSwitch extends HTMLElement {
  connectedCallback() {
    if (this._ready) return;
    this._ready = true;
    this.setAttribute('role', 'switch');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this._sync();
    this.addEventListener('click', this._click);
    this.addEventListener('keydown', this._keydown);
  }
  disconnectedCallback() {
    this.removeEventListener('click', this._click);
    this.removeEventListener('keydown', this._keydown);
    this._ready = false;
  }
  get checked() { return this.hasAttribute('checked'); }
  set checked(value) { this.toggleAttribute('checked', Boolean(value)); this._sync(); }
  _sync() {
    const checked = this.checked;
    this.setAttribute('aria-checked', String(checked));
    this.setAttribute('aria-disabled', String(this.hasAttribute('disabled')));
    this.toggleAttribute('data-state-checked', checked);
    this.toggleAttribute('data-state-unchecked', !checked);
    this.tabIndex = this.hasAttribute('disabled') ? -1 : 0;
  }
  _toggle() {
    if (this.hasAttribute('disabled')) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('checked-change', { bubbles: true, detail: { checked: this.checked } }));
  }
  _click = () => this._toggle();
  _keydown = (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    this._toggle();
  };
}
if (!customElements.get(TAG)) customElements.define(TAG, DatastarSwitch);
