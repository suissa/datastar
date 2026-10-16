// Icon: lucide:component
// Slug: Interprets declarative UI components and coordinates their classes and events.
// Description: Adds class-based behavior to components declared with data-component.

import { attribute } from '@engine'

const OPEN = 'open'
const CLOSED = 'closed'
let generatedContentId = 0

type ComponentElement = HTMLElement

const setState = (el: ComponentElement, open: boolean): void => {
  const state = open ? OPEN : CLOSED
  if (el.dataset.state !== state) el.dataset.state = state
  el.classList.toggle('is-open', open)
  el.classList.toggle('is-closed', !open)
}

const getParts = (item: ComponentElement) => ({
  trigger: item.querySelector<ComponentElement>(
    '[data-component="accordion-trigger"]',
  ),
  content: item.querySelector<ComponentElement>(
    '[data-component="accordion-content"]',
  ),
})

const syncItem = (item: ComponentElement, open: boolean): void => {
  const { trigger, content } = getParts(item)
  item.classList.add('ui-accordion__item')
  setState(item, open)

  if (trigger) {
    trigger.classList.add('ui-accordion__trigger')
    trigger.setAttribute('aria-expanded', String(open))
    if (content) {
      if (!content.id) {
        generatedContentId += 1
        content.id = `ds-accordion-content-${generatedContentId}`
      }
      trigger.setAttribute('aria-controls', content.id)
    }
    setState(trigger, open)
  }

  if (content) {
    content.classList.add('ui-accordion__content')
    content.hidden = !open
    setState(content, open)
  }
}

const initializeAccordion = (root: ComponentElement): (() => void) => {
  root.classList.add('ui-accordion')
  const mode = () => root.dataset.accordionMode ?? 'single'

  for (const item of root.querySelectorAll<ComponentElement>(
    '[data-component="accordion-item"]',
  )) {
    const { trigger } = getParts(item)
    syncItem(
      item,
      item.dataset.state === OPEN ||
        trigger?.getAttribute('aria-expanded') === 'true',
    )
  }

  const onClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const trigger = target.closest<ComponentElement>(
      '[data-component="accordion-trigger"]',
    )
    if (!trigger || !root.contains(trigger)) return
    if (
      trigger.hasAttribute('disabled') ||
      trigger.getAttribute('aria-disabled') === 'true'
    ) {
      return
    }

    const item = trigger.closest<ComponentElement>(
      '[data-component="accordion-item"]',
    )
    if (!item || !root.contains(item)) return

    const isOpen = item.dataset.state === OPEN
    if (mode() === 'single') {
      for (const sibling of root.querySelectorAll<ComponentElement>(
        '[data-component="accordion-item"]',
      )) {
        if (sibling !== item) syncItem(sibling, false)
      }
    }
    syncItem(item, !isOpen)
  }

  root.addEventListener('click', onClick)
  return () => {
    root.removeEventListener('click', onClick)
    root.classList.remove('ui-accordion')
  }
}

attribute({
  name: 'component',
  requirement: {
    key: 'denied',
    value: 'must',
  },
  apply({ el, value }) {
    if (!(el instanceof HTMLElement)) return
    const component = value.trim()

    switch (component) {
      case 'accordion':
        return initializeAccordion(el)
      case 'accordion-item':
        el.classList.add('ui-accordion__item')
        setState(el, el.dataset.state === OPEN)
        break
      case 'accordion-trigger':
        el.classList.add('ui-accordion__trigger')
        break
      case 'accordion-content':
        el.classList.add('ui-accordion__content')
        break
      default:
        // Unknown component names remain valid HTML and can be handled by extensions.
        el.dispatchEvent(
          new CustomEvent('datastar-component:unknown', {
            bubbles: true,
            detail: { component, element: el },
          }),
        )
    }
  },
})
