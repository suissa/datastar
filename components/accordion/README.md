# Datastar Accordion

A native Web Component implementation of the Radix Accordion composition model, designed to work alongside Datastar without React or a virtual DOM.

## Parts

- `<ds-accordion type="single">` — only one item can be open.
- `<ds-accordion type="multiple">` — any number of items can be open.
- `<ds-accordion-item value="unique-id">` — an item with a unique value.
- `<ds-accordion-header>` — semantic heading wrapper.
- `<ds-accordion-trigger>` — accessible button that toggles its item.
- `<ds-accordion-content>` — collapsible panel.

## Usage

Include the stylesheet and module, then compose the parts in HTML:

```html
<link rel="stylesheet" href="/components/accordion/accordion.css">
<script type="module" src="/components/accordion/accordion.js"></script>

<ds-accordion type="single" collapsible>
  <ds-accordion-item value="getting-started">
    <ds-accordion-header>
      <ds-accordion-trigger>Getting started</ds-accordion-trigger>
    </ds-accordion-header>
    <ds-accordion-content>
      <p>Your content goes here.</p>
    </ds-accordion-content>
  </ds-accordion-item>
</ds-accordion>
```

## API

| Attribute | Element | Description |
| --- | --- | --- |
| `type` | `ds-accordion` | `single` (default) or `multiple` |
| `value` | `ds-accordion` | Current open item for single mode |
| `default-value` | `ds-accordion` | Initial open item for single mode |
| `value` | `ds-accordion-item` | Required unique item value |
| `disabled` | accordion/item/trigger | Disables interaction |
| `collapsible` | `ds-accordion` | Allows closing the last open item in single mode |

The root dispatches a bubbling `value-change` CustomEvent whenever its open value changes. Its `detail.value` is a string in single mode and an array of strings in multiple mode. Set the root's `value` property to control its current value programmatically.

Keyboard support includes Arrow Up/Down (vertical), Arrow Left/Right (horizontal), Home, End, Enter and Space. Triggers expose `aria-expanded`, `aria-controls`, and panels expose `role="region"` and `aria-labelledby`.

This is an independent implementation inspired by the compositional API of Radix UI; it does not copy or bundle Radix source code.
