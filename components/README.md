# Datastar Components

Framework-independent Web Components inspired by the compositional API and accessibility patterns of Radix UI. These are independent implementations and do not bundle or copy Radix source.

## Components

- [Accordion](./accordion/README.md) — single/multiple disclosure panels.
- [Audio Player](./audio-player/README.md) — responsive playlist player with playback, seeking, volume, shuffle, and repeat controls.
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


## Declarative component interpreter

For HTML-first components, use the shared interpreter in `bundles/datastar-components.js` with the class-based stylesheet `bundles/datastar-components.css`. Load it after the normal Datastar bundle:

```html
<script type="module" src="/bundles/datastar.js"></script>
<script defer src="/bundles/datastar-components.js"></script>
<link rel="stylesheet" href="/bundles/datastar-components.css">
```

The first component supported by this interpreter is an accordion:

```html
<section data-component="accordion" data-accordion-mode="single">
  <article data-component="accordion-item" data-state="closed">
    <h2>
      <button type="button" data-component="accordion-trigger">
        First item
      </button>
    </h2>
    <div data-component="accordion-content">
      Content for the first item.
    </div>
  </article>
</section>
```

Supported component names are `accordion`, `accordion-item`, `accordion-trigger`, and `accordion-content`. Use `data-accordion-mode="multiple"` to allow multiple items to remain open; the default is `single`.

The interpreter uses a MutationObserver so component declarations in HTML added later (including server-patched HTML) are initialized too. It updates `data-state`, ARIA attributes, and classes such as `ui-accordion__item`, `ui-accordion__trigger`, `ui-accordion__content`, `is-open`, and `is-closed`. CSS controls presentation. It does not require a separate JavaScript file for each component.

Set `data-accordion-item-mode="single"` on the accordion root to allow only one open item, or `data-accordion-item-mode="multiple"` to allow several. The older `data-accordion-mode` attribute remains supported for compatibility. Add a button with `data-accordion-action="openAll"` to open every item in multiple mode; the action is ignored in single mode. `data-accordion-action="closeAll"` closes every item in either mode.

The TypeScript plugin is also registered in `library/src/bundles/datastar.ts`, so it is included when the Datastar library bundle is rebuilt. The standalone `bundles/datastar-components.js` is provided for testing the interpreter before rebuilding the main generated bundle.
