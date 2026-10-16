const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')

const bundle = readFileSync(
  join(__dirname, '..', 'bundles', 'datastar-components.js'),
  'utf8',
)

function setup(markup, options = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    ...options,
  })
  dom.window.eval(bundle)
  return dom
}

const accordion = (mode = 'single') => `
  <section id="acc" data-component="accordion" data-accordion-item-mode="${mode}">
    <article id="item-a" data-component="accordion-item" data-state="closed">
      <button id="trigger-a" data-component="accordion-trigger" type="button">A</button>
      <div id="content-a" data-component="accordion-content">Content A</div>
    </article>
    <article id="item-b" data-component="accordion-item" data-state="closed">
      <button id="trigger-b" data-component="accordion-trigger" type="button">B</button>
      <div id="content-b" data-component="accordion-content">Content B</div>
    </article>
  </section>
`

const tick = async (window) => {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

test('initializes classes, closed state, hidden content, and ARIA relationships', () => {
  const dom = setup(accordion())
  const { document } = dom.window
  const root = document.querySelector('#acc')
  const trigger = document.querySelector('#trigger-a')
  const content = document.querySelector('#content-a')

  assert.ok(root.classList.contains('ui-accordion'))
  assert.ok(document.querySelector('#item-a').classList.contains('ui-accordion__item'))
  assert.ok(trigger.classList.contains('ui-accordion__trigger'))
  assert.ok(content.classList.contains('ui-accordion__content'))
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  assert.equal(trigger.getAttribute('aria-controls'), 'content-a')
  assert.equal(content.hidden, true)
  assert.equal(document.querySelector('#item-a').dataset.state, 'closed')
  dom.window.close()
})

test('opens an item on click and updates ARIA and content visibility', () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  document.querySelector('#trigger-a').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(document.querySelector('#item-a').dataset.state, 'open')
  assert.equal(document.querySelector('#trigger-a').getAttribute('aria-expanded'), 'true')
  assert.equal(document.querySelector('#content-a').hidden, false)
  assert.ok(document.querySelector('#content-a').classList.contains('animate__slideInDown'))
  dom.window.close()
})

test('state observer does not cancel opening or closing animations', async () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  const trigger = document.querySelector('#trigger-a')
  const content = document.querySelector('#content-a')

  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await tick(dom.window)
  assert.ok(content.classList.contains('animate__slideInDown'))

  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await tick(dom.window)
  assert.ok(content.classList.contains('animate__slideOutUp'))

  dom.window.close()
})

test('single mode closes the previously open sibling', () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  document.querySelector('#trigger-a').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  document.querySelector('#trigger-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(document.querySelector('#item-a').dataset.state, 'closed')
  assert.equal(document.querySelector('#content-a').hidden, false)
  assert.ok(document.querySelector('#content-a').classList.contains('animate__slideOutUp'))
  document.querySelector('#content-a').dispatchEvent(new dom.window.Event('animationend', { bubbles: true }))
  assert.equal(document.querySelector('#content-a').hidden, true)
  assert.equal(document.querySelector('#item-b').dataset.state, 'open')
  assert.equal(document.querySelector('#content-b').hidden, false)
  dom.window.close()
})

test('multiple mode allows two items to remain open', () => {
  const dom = setup(accordion('multiple'))
  const { document, MouseEvent } = dom.window
  document.querySelector('#trigger-a').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  document.querySelector('#trigger-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(document.querySelector('#item-a').dataset.state, 'open')
  assert.equal(document.querySelector('#item-b').dataset.state, 'open')
  dom.window.close()
})

test('openAll opens every item in multiple mode', () => {
  const dom = setup(accordion('multiple'))
  const { document, MouseEvent } = dom.window
  const action = document.createElement('button')
  action.dataset.accordionAction = 'openAll'
  document.querySelector('#acc').append(action)
  action.dispatchEvent(new MouseEvent('click', { bubbles: true }))

  for (const item of document.querySelectorAll('[data-component="accordion-item"]')) {
    assert.equal(item.dataset.state, 'open')
    assert.equal(item.querySelector('[data-component="accordion-content"]').hidden, false)
  }
  dom.window.close()
})

test('openAll is ignored in single mode', () => {
  const dom = setup(accordion('single'))
  const { document, MouseEvent } = dom.window
  const action = document.createElement('button')
  action.dataset.accordionAction = 'openAll'
  document.querySelector('#acc').append(action)
  action.dispatchEvent(new MouseEvent('click', { bubbles: true }))

  for (const item of document.querySelectorAll('[data-component="accordion-item"]')) {
    assert.equal(item.dataset.state, 'closed')
    assert.equal(item.querySelector('[data-component="accordion-content"]').hidden, true)
  }
  dom.window.close()
})

test('closeAll closes every item in multiple mode', () => {
  const dom = setup(accordion('multiple'))
  const { document, MouseEvent } = dom.window
  document.querySelector('#trigger-a').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  document.querySelector('#trigger-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  const action = document.createElement('button')
  action.dataset.accordionAction = 'closeAll'
  document.querySelector('#acc').append(action)
  action.dispatchEvent(new MouseEvent('click', { bubbles: true }))

  for (const item of document.querySelectorAll('[data-component="accordion-item"]')) {
    assert.equal(item.dataset.state, 'closed')
  }
  dom.window.close()
})

test('clicking an open item closes it', () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  const trigger = document.querySelector('#trigger-a')
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(document.querySelector('#item-a').dataset.state, 'closed')
  assert.equal(trigger.getAttribute('aria-expanded'), 'false')
  dom.window.close()
})

test('disabled triggers do not change accordion state', () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  const trigger = document.querySelector('#trigger-a')
  trigger.setAttribute('disabled', '')
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(document.querySelector('#item-a').dataset.state, 'closed')
  dom.window.close()
})

test('items inserted after startup are interpreted and interactive', async () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  const item = document.createElement('article')
  item.id = 'item-c'
  item.dataset.component = 'accordion-item'
  item.dataset.state = 'closed'
  item.innerHTML = '<button id="trigger-c" data-component="accordion-trigger" type="button">C</button><div id="content-c" data-component="accordion-content">C content</div>'
  document.querySelector('#acc').append(item)
  await tick(dom.window)
  assert.ok(item.classList.contains('ui-accordion__item'))
  document.querySelector('#trigger-c').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(item.dataset.state, 'open')
  assert.equal(document.querySelector('#content-c').hidden, false)
  dom.window.close()
})

test('data-state changes on an item synchronize content and ARIA', async () => {
  const dom = setup(accordion())
  const { document } = dom.window
  const item = document.querySelector('#item-a')
  item.dataset.state = 'open'
  await tick(dom.window)
  assert.equal(document.querySelector('#trigger-a').getAttribute('aria-expanded'), 'true')
  assert.equal(document.querySelector('#content-a').hidden, false)
  dom.window.close()
})

test('unknown component names emit an extensibility event', async () => {
  const dom = setup('<div id="custom" data-component="my-extension"></div>')
  let detail
  // Listen on the document because the custom event bubbles from dynamically added components.
  dom.window.document.addEventListener(
    'datastar-component:unknown',
    (event) => { detail = event.detail },
  )
  const element = dom.window.document.createElement('div')
  element.dataset.component = 'my-extension'
  dom.window.document.body.append(element)
  await tick(dom.window)
  assert.equal(detail.component, 'my-extension')
  assert.equal(detail.element, element)
  dom.window.close()
})

test('multiple initialization does not duplicate accordion click handling', () => {
  const dom = setup(accordion())
  const { document, MouseEvent } = dom.window
  const root = document.querySelector('#acc')
  root.dataset.component = ''
  root.dataset.component = 'accordion'
  document.querySelector('#trigger-a').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  assert.equal(document.querySelector('#item-a').dataset.state, 'open')
  dom.window.close()
})
