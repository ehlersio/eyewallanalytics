// scripts/cypress-full.mjs
// Warms up Vite dev server by loading actual JS modules (not just HTML),
// then runs Cypress tests.

import { execSync, spawn } from 'child_process'

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' })
    return 0
  } catch (e) {
    return e.status || 1
  }
}

async function warmUpVite() {
  const base = 'http://localhost:5173'
  console.log('\n🔥 Warming up Vite dev server...')

  // Step 1: Fetch index.html to get the entry script URL
  let entryScript = null
  try {
    const html = await fetch(base).then(r => r.text())
    const match = html.match(/src="([^"]*\.jsx?[^"]*)"/)
    entryScript = match?.[1]
    console.log('   index.html → OK')
    if (entryScript) console.log(`   Entry: ${entryScript}`)
  } catch (e) {
    console.warn('   index.html failed:', e.message)
    return
  }

  // Step 2: Fetch the entry JS — this triggers Vite to compile the full module graph
  if (entryScript) {
    const entryUrl = entryScript.startsWith('http') ? entryScript : `${base}${entryScript}`
    try {
      const js = await fetch(entryUrl).then(r => r.text())
      console.log(`   ${entryScript} → ${Math.round(js.length/1024)}KB compiled`)
    } catch (e) {
      console.warn('   Entry JS fetch failed:', e.message)
    }
  }

  // Step 3: Hit all main routes to trigger route-level code splitting
  const routes = ['/', '/schedule', '/players', '/team', '/news']
  for (const route of routes) {
    try {
      await fetch(`${base}${route}`).then(r => r.text())
      process.stdout.write(`   ${route} ✓  `)
    } catch {}
  }
  console.log()

  // Step 4: Wait for Vite's async transforms to settle
  console.log('   Waiting for transforms to settle...')
  await new Promise(r => setTimeout(r, 8000))
  console.log('✅ Vite warmed up\n')
}

console.log('\n🧹 Cleaning reports...')
run('npm run cypress:clean')

await warmUpVite()

console.log('\n🧪 Running tests...')
const testCode = run('npx cypress run --headless --config numTestsKeptInMemory=0')

console.log('\n📊 Generating report...')
run('npm run cypress:report')

if (testCode !== 0) {
  console.log(`\n❌ Tests failed (exit code ${testCode})`)
  process.exit(testCode)
} else {
  console.log('\n✅ All tests passed')
}
