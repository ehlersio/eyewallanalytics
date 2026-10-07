// utils/__tests__/testHelpers/renderHook.jsx
// Runs a React hook for real -- effects in declaration order, state
// updates, re-renders -- under Vitest's node environment, which has no
// DOM. react-dom only needs a container that looks like an element for
// a tree that renders nothing, plus the two browser globals it reads
// while committing (window.event, window.HTMLIFrameElement).
//
//   const h = renderHook(props => useThing(props.a), { a: 1 })
//   h.result.current      // the hook's latest return value
//   h.rerender({ a: 2 })  // render again with new props, flushing effects
//   await h.flush()       // let pending promises (fetches) settle; works
//                         // under vi.useFakeTimers() too
//   h.unmount()
//
// Also installs an in-memory sessionStorage, cleared by resetSessionStorage().

import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Set at the first render, not on import: modules imported alongside this
// one (posthog-js) take a global `window` to mean a real browser.
function installBrowserGlobals() {
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis
  if (typeof globalThis.HTMLIFrameElement === 'undefined') globalThis.HTMLIFrameElement = class {}
}

const store = new Map()
globalThis.sessionStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: k => { store.delete(k) },
  clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null,
  get length() { return store.size },
}
export function resetSessionStorage() { store.clear() }

function fakeContainer() {
  const noop = () => {}
  const ownerDocument = { nodeType: 9, addEventListener: noop, removeEventListener: noop }
  return {
    nodeType: 1, tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument, addEventListener: noop, removeEventListener: noop,
  }
}

export function renderHook(useHook, initialProps) {
  installBrowserGlobals()
  const result = { current: undefined }
  function Probe({ hookProps }) {
    result.current = useHook(hookProps)
    return null
  }
  const root = createRoot(fakeContainer())
  const render = props => act(() => { root.render(<Probe hookProps={props} />) })
  render(initialProps)
  return {
    result,
    rerender: render,
    flush: () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }),
    unmount: () => act(() => { root.unmount() }),
  }
}
