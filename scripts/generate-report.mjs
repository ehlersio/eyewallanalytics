// scripts/generate-report.mjs
import { createRequire } from 'module'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

const require = createRequire(import.meta.url)

const JSON_DIR = 'cypress/reports/json'
const OUT_DIR  = 'cypress/reports/html'

if (!existsSync(JSON_DIR)) {
  console.error(`❌  No reports found at ${JSON_DIR} — run npm run cypress:run first.`)
  process.exit(1)
}

const jsonFiles = readdirSync(JSON_DIR).filter(f => f.endsWith('.json'))
if (!jsonFiles.length) {
  console.error(`❌  No JSON files found in ${JSON_DIR}`)
  process.exit(1)
}

console.log(`📄  Found ${jsonFiles.length} report(s)`)

let merge, generator
try {
  merge = require('mochawesome-merge').merge
} catch {
  console.error('❌  mochawesome-merge not found. Run: npm install --save-dev mochawesome-merge')
  process.exit(1)
}
try {
  generator = require('mochawesome-report-generator')
} catch {
  console.error('❌  mochawesome-report-generator not found. Run: npm install --save-dev mochawesome-report-generator')
  process.exit(1)
}

// Pass absolute paths with forward slashes — mochawesome-merge requires this on Windows
const absPaths = jsonFiles.map(f => resolve(join(JSON_DIR, f)).replace(/\\/g, '/'))
console.log('🔀  Merging reports...')
const merged = await merge({ files: absPaths })

mkdirSync(OUT_DIR, { recursive: true })
console.log('📊  Generating HTML report...')
await generator.create(merged, {
  reportDir:      OUT_DIR,
  reportFilename: 'merged',
  inline:         true,
  quiet:          false,
  overwrite:      true,
})

console.log(`\n✅  Report ready: ${resolve(join(OUT_DIR, 'merged.html'))}`)
