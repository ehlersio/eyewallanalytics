// cypress/support/answerInPage.js
// Answers a spec's stubbed non-GET requests inside the page, instead of
// with a cy.intercept stub. Use it for any stubbed POST/PUT/PATCH/DELETE.
//
// Why: in CI, Chrome 155.0.8059.39 (on some GitHub runner images from
// 2026-10-17) crashes its network service now and then while Cypress's
// proxy answers a cy.intercept-stubbed POST. Chrome restarts the service,
// and every connection the page had drops in that millisecond: the POST
// fails ("Failed to fetch"), a module import() in flight fails, and Vite's
// HMR WebSocket closes (1006), so Vite's client reloads the page ~150 ms
// later and the test goes on against a page that has started over. That
// was hockeytech-period-summary.cy.js's flake (#545), auth.cy.js's "No
// request ever occurred" for its OTP POST, and a "Failed to fetch
// dynamically imported module" in hockeytech-guest-game-invariants.cy.js.
// A/B in CI (Chrome's stderr logged), the stubbed POST looped: on
// 155.0.8059.39, 45 of 840 runs failed and each failure lined up with a
// logged "Network service crashed"; answered in the page, 0 of 360 on the
// same build. 155.0.8059.84 and 154 never crashed (0 of 1,200 runs, 960
// of them stubbed).
// A request answered here never reaches the proxy, so it can't trigger it,
// whichever Chrome the runner has. Real users never go through the proxy.
//
// answerInPage(routes) wraps window.fetch in every page the current test
// loads (cy.on('window:before:load'), so cy.reload and later cy.visit calls
// are covered too). Call it before the test's first cy.visit. A route is
//   { method: 'POST' | /^(PUT|PATCH)$/, url: /regexp/, reply, calls }
// where `reply` is { statusCode, body, headers } or a function of the call
// returning one, read when the request is made (so a test may swap it), and
// `calls` (created if missing) collects each request as
// { method, url, headers, body, at }: headers lower-cased, body JSON-parsed
// when it parses, `at` the Date.now() it was made. The app only sends
// through fetch, but each route also gets a cy.intercept that fails the
// test if one of its requests reaches the proxy anyway, so a stubbed
// request can never get to the real service.

const NULL_BODY_STATUSES = [101, 204, 205, 304]

const methodMatches = (route, method) =>
  route.method instanceof RegExp ? route.method.test(method) : route.method.toUpperCase() === method

function respond(win, reply) {
  const { statusCode = 200, body = {}, headers = {} } = reply
  const text = NULL_BODY_STATUSES.includes(statusCode) || body == null ? null
    : typeof body === 'string' ? body : JSON.stringify(body)
  return new win.Response(text, { status: statusCode, headers: { 'Content-Type': 'application/json', ...headers } })
}

function wrapFetch(win, routes) {
  const fetch = win.fetch.bind(win)
  win.fetch = (input, init = {}) => {
    const isRequest = input instanceof win.Request
    const method = String(init.method || (isRequest ? input.method : 'GET')).toUpperCase()
    const url = new win.URL(isRequest ? input.url : String(input), win.location.href).href
    const route = routes.find(r => methodMatches(r, method) && r.url.test(url))
    if (!route) return fetch(input, init)

    const request = new win.Request(input, init)
    return request.text().then(text => {
      let body = text || null
      try { body = JSON.parse(text) } catch { /* not JSON: keep the text */ }
      const call = { method, url, headers: Object.fromEntries(request.headers), body, at: Date.now() }
      route.calls.push(call)
      return respond(win, typeof route.reply === 'function' ? route.reply(call) : route.reply)
    })
  }
}

export function answerInPage(routes) {
  for (const route of routes) {
    route.calls ??= []
    cy.intercept({ method: route.method, url: route.url }, req => {
      throw new Error(`${req.method} ${req.url} reached Cypress's proxy; answerInPage should have answered it in the page`)
    })
  }
  cy.on('window:before:load', win => wrapFetch(win, routes))
}

// The route's first request, once the page has made it.
export const firstCall = route => cy.wrap(route.calls).should('have.length.gte', 1).its(0)
