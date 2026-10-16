# Datastar Components

Framework-independent Web Components inspired by the compositional API and accessibility patterns of Radix UI. These are independent implementations and do not bundle or copy Radix source.

## Components

- [Accordion](./accordion/README.md) — single/multiple disclosure panels.
- **Tabs** — `ds-tabs`, `ds-tabs-list`, `ds-tabs-trigger`, `ds-tabs-content`.
- **Checkbox** — `ds-checkbox`, with `checked`, `disabled`, and a bubbling `checked-change` event.
- **Switch** — `ds-switch`, with `checked`, `disabled`, and a bubbling `checked-change` event.

## Example

Serve the repository root over HTTP and open [examples/radix-components.html](../examples/radix-components.html). The page demonstrates Tabs, Checkbox, and Switch.

Each component has its own JavaScript module and stylesheet under `components/<name>/`. Values are available through element properties; state changes emit bubbling custom events.
