# Datastar Components

Framework-independent Web Components inspired by the compositional API and accessibility patterns of Radix UI. These are independent implementations and do not bundle or copy Radix source.

## Components

- [Accordion](./accordion/README.md) — single/multiple disclosure panels.
- **Tabs** — `ds-tabs`, `ds-tabs-list`, `ds-tabs-trigger`, `ds-tabs-content`.
- **Checkbox** — `ds-checkbox`, with `checked`, `disabled`, and a bubbling `checked-change` event.
- **Switch** — `ds-switch`, with `checked`, `disabled`, and a bubbling `checked-change` event.

## Run the component modules

The module-backed demo imports files from `../components/`. The static server's root must therefore be the repository root, not the `examples/` directory.

From the repository root, run:

```sh
npx live-server .
```

Then open `/examples/radix-components.html` in the served site. Opening this module-based demo directly as `file://` is not supported reliably because browsers restrict ES module loading from local files.

## Run without JavaScript

Open [examples/radix-components-no-js.html](../examples/radix-components-no-js.html) directly, or run `npx live-server examples` from the repository root and open `/radix-components-no-js.html`.

This second page uses native HTML and CSS only: radio inputs for tabs, native checkboxes, checkbox-based switches, and `details/summary` for disclosure. It does not import the Web Component modules or the Datastar runtime.

Datastar's reactive attributes require the Datastar JavaScript runtime. CSS and native HTML can cover some interactions without JavaScript, but cannot provide the full Datastar reactive model or all Radix-style component behavior.

Each component has its own JavaScript module and stylesheet under `components/<name>/`. Values are available through element properties; state changes emit bubbling custom events.
