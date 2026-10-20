// cypress/support/answerInPage.js
// Answers a spec's stubbed non-GET requests inside the page, instead of
// with a cy.intercept stub. Use it for any stubbed POST/PUT/PATCH/DELETE.
//
// Why: in CI (Linux, Chrome, roughly 1 run in 100), a POST stubbed with
// cy.intercept sometimes fails with "Failed to fetch", and in that same
// millisecond every connection the page has through Cypress's proxy drops,
// Vite's HMR WebSocket included (close 1006). Vite's client then reloads
// the page ~150 ms later, and whatever the test asserts next finds a page
// that has started over. In-page logging proved this for
// hockeytech-period-summary.cy.js (#545: 5 failures in ~470 looped runs
// with the cy.intercept stub, 0 in 240 answered in the page). The same
// window shows up as auth.cy.js's "No request ever occurred" for its
// stubbed OTP POST and as a "Failed to fetch dynamically imported module"
// while hockeytech-guest-game-invariants.cy.js's stubbed user_preferences
// POST was in flight. A request answered here never reaches the proxy.
// It's a test-harness problem: there's no proxy or HMR socket in a real
// browser.
//
// answerInPage(routes) wraps window.fetch in every page the current test
// loads (cy.on('window:before:load'), so cy.reload and later cy.visit calls
// are covered too). Call it before the test's first cy.visit. A route is
//   { method: 'POST' | /^(PUT|PATCH)$/, url: /regexp/, reply, calls }
// where `reply` is { statusCode, body, headers } or a function of the call
// returning one, read when the request is made (so a test may swap it), and
// `calls` (created if missing) collects each request as
// { method, url, headers, body }: headers lower-cased, body JSON-parsed
// when it parses. The app only sends through fetch, but each route also
// gets a cy.intercept that fails the test if one of its requests reaches
// the proxy anyway, so a stubbed request can never get to the real service.

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
      const call = { method, url, headers: Object.fromEntries(request.headers), body }
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
