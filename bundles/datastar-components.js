// Datastar Declarative Components
// A class-first interpreter for data-component attributes.
// Load after the Datastar runtime. Components use one shared interpreter, not per-component JS.

(() => {
  const OPEN = 'open'
  const CLOSED = 'closed'
  let nextContentId = 0
  const accordionCleanups = new WeakMap()

  const setState = (element, open) => {
    const state = open ? OPEN : CLOSED
    if (element.dataset.state !== state) element.dataset.state = state
    element.classList.toggle('is-open', open)
    element.classList.toggle('is-closed', !open)
  }

  const parts = (item) => ({
    trigger: item.querySelector('[data-component="accordion-trigger"]'),
    content: item.querySelector('[data-component="accordion-content"]'),
  })

  const syncItem = (item, open) => {
    const { trigger, content } = parts(item)
    item.classList.add('ui-accordion__item')
    setState(item, open)

    if (trigger) {
      trigger.classList.add('ui-accordion__trigger')
      trigger.setAttribute('aria-expanded', String(open))
      if (content) {
        if (!content.id) content.id = `ds-accordion-content-${++nextContentId}`
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

  const initAccordion = (root) => {
    if (accordionCleanups.has(root)) return
    root.classList.add('ui-accordion')

    const items = () =>
      root.querySelectorAll('[data-component="accordion-item"]')
    const syncAll = () => {
      for (const item of items()) {
        const { trigger } = parts(item)
        syncItem(
          item,
          item.dataset.state === OPEN ||
            trigger?.getAttribute('aria-expanded') === 'true',
        )
      }
    }

    syncAll()
    const onClick = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const trigger = target.closest('[data-component="accordion-trigger"]')
      if (!trigger || !root.contains(trigger)) return
      if (
        trigger.hasAttribute('disabled') ||
        trigger.getAttribute('aria-disabled') === 'true'
      ) return

      const item = trigger.closest('[data-component="accordion-item"]')
      if (!item || !root.contains(item)) return
      const wasOpen = item.dataset.state === OPEN

      if ((root.dataset.accordionMode || 'single') === 'single') {
        for (const sibling of items()) {
          if (sibling !== item) syncItem(sibling, false)
        }
      }
      syncItem(item, !wasOpen)
    }

    root.addEventListener('click', onClick)
    accordionCleanups.set(root, () => {
      root.removeEventListener('click', onClick)
      root.classList.remove('ui-accordion')
    })
  }

  const interpret = (element) => {
    if (!(element instanceof HTMLElement)) return
    const component = element.dataset.component
    if (!component) return

    switch (component) {
      case 'accordion':
        initAccordion(element)
        break
      case 'accordion-item':
        element.classList.add('ui-accordion__item')
        setState(element, element.dataset.state === OPEN)
        break
      case 'accordion-trigger':
        element.classList.add('ui-accordion__trigger')
        break
      case 'accordion-content':
        element.classList.add('ui-accordion__content')
        break
      default:
        element.dispatchEvent(new CustomEvent('datastar-component:unknown', {
          bubbles: true,
          detail: { component, element },
        }))
    }
  }

  const interpretTree = (node) => {
    if (!(node instanceof Element)) return
    interpret(node)
    for (const element of node.querySelectorAll('[data-component]')) {
      interpret(element)
    }
  }

  interpretTree(document.documentElement)

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) interpretTree(node)
      } else if (
        record.type === 'attributes' &&
        record.attributeName === 'data-component'
      ) {
        interpret(record.target)
      } else if (
        record.type === 'attributes' &&
        record.attributeName === 'data-state' &&
        record.target instanceof HTMLElement &&
        record.target.dataset.component === 'accordion-item'
      ) {
        syncItem(
          record.target,
          record.target.dataset.state === OPEN,
        )
      }
    }
  })

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-component', 'data-state'],
  })

  document.dispatchEvent(new CustomEvent('datastar-components-ready'))
})()
