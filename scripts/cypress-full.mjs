// scripts/cypress-full.mjs
// Runs cypress:clean, cypress:run, then cypress:report regardless of test failures.
// Exits with the same code as cypress:run so CI still fails on test failures.

import { execSync } from 'child_process'

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' })
    return 0
  } catch (e) {
    return e.status || 1
  }
}

console.log('\n🧹 Cleaning reports...')
run('npm run cypress:clean')

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
