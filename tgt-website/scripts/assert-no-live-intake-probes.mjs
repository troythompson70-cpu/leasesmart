#!/usr/bin/env node
/**
 * Static guard + policy reminder: never probe production /api/intake with
 * fabricated addresses. Local Vite intake is the only allowed automated target.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const forbiddenPatterns = [
  /tgttechnologies\.com\/api\/intake/,
  /https:\/\/www\.tgttechnologies\.com\/api\/intake/,
]

const scanFiles = [
  'scripts/intake-validation-check.mjs',
  'scripts/mailbox-coverage-watch.mjs',
  'scripts/verify-dashboard-feed.mjs',
  'scripts/verify-dashboard-feed-check.mjs',
  'server/verify-dashboard-feed.ts',
  'scripts/mailbox-coverage-once.sh',
  'scripts/promote-on-mailbox-200.sh',
  'scripts/install-mailbox-coverage-watch.sh',
  'src/lib/intake.ts',
  'src/lib/intake-probe-guard.ts',
  'server/intake-http.ts',
]

for (const rel of scanFiles) {
  const text = readFileSync(join(root, rel), 'utf8')
  for (const pattern of forbiddenPatterns) {
    // Allow mentioning the host in comments/docs strings about the ban,
    // but forbid constructing a live POST target string.
    const livePost = new RegExp(
      String.raw`fetch\(\s*['"\`]https?://(?:www\.)?tgttechnologies\.com/api/intake`,
    )
    assert.equal(livePost.test(text), false, `${rel} must not fetch live production intake`)
    void pattern
  }
  pass(`no live production intake fetch in ${rel}`)
}

function pass(name) {
  console.log(`PASS ${name}`)
}

console.log(
  'POLICY: Automated tests must use local Vite /api/intake (X-TGT-Intake-Mode: local-mock-no-smtp). Never POST fabricated emails to production Exchange.',
)
console.log('All no-live-intake probe checks passed.')
