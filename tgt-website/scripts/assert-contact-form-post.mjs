/**
 * T1: contact dialog must POST to /api/intake.
 * A missing method attribute is GET to the current page, which puts fields in the URL.
 * Local mock only. Never calls tgttechnologies.com.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { intakeConfig } from '../src/lib/intake.ts'
import { handleIntakeRequest } from '../server/intake-http.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const contactFormFile = path.join(here, '../src/components/LeadInquiryModal.tsx')
const newsletterFormFile = path.join(here, '../src/components/TipsSignupForm.tsx')
const contactSource = readFileSync(contactFormFile, 'utf8')
const newsletterSource = readFileSync(newsletterFormFile, 'utf8')

function pass(name) {
  console.log(`PASS ${name}`)
}

function assertPostIntakeForm(source, label) {
  const formTag = source.match(/<form\b[\s\S]*?>/)
  assert.ok(formTag, `${label} must render a form`)
  assert.match(formTag[0], /method="post"/, `${label} method must be post`)
  assert.match(
    formTag[0],
    /action=\{intakeConfig\.apiEndpoint\}/,
    `${label} action must be the intake endpoint`,
  )
  assert.doesNotMatch(formTag[0], /method=["']get["']/i)
}

assertPostIntakeForm(contactSource, 'contact form')
assertPostIntakeForm(newsletterSource, 'newsletter form')
assert.match(
  newsletterSource,
  /import\s*\{[^}]*\bintakeConfig\b[^}]*\}\s*from\s*['"]\.\.\/lib\/intake['"]/,
  'TipsSignupForm must import intakeConfig from ../lib/intake',
)
assert.equal(intakeConfig.mode, 'api')
assert.equal(intakeConfig.apiEndpoint, '/api/intake')
pass('contact form is POST /api/intake')
pass('newsletter form is POST /api/intake')

const payload = {
  schemaVersion: '1.1',
  requestType: 'assessment',
  submissionId: '11111111-1111-4111-8111-111111111111',
  name: 'QA TEST - DO NOT CONTACT',
  company: 'QA TEST COMPANY',
  email: 'qa-test-donotcontact@example.com',
  bestCallbackNumber: '555-0100',
  numberOfPcs: '',
  server: '',
  existingNetworkWifi: '',
  internetConnectivityIssue: [],
  currentItSupport: [],
  message: 'QA TEST contact form local mock. Do not contact.',
  newsletterConsent: false,
  newsletterPhonePlatform: '',
  newsletterConsentTextVersion: '',
  source: 'tgt-website-contact',
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/api/intake') {
    void handleIntakeRequest(req, res)
    return
  }
  res.statusCode = 404
  res.end()
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert.ok(address && typeof address === 'object')
const origin = `http://127.0.0.1:${address.port}`

try {
  const response = await fetch(`${origin}/api/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  const mode = response.headers.get('x-tgt-intake-mode')

  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.delivery, 'confirmed')
  assert.equal(body.smtp, 'disabled')
  assert.equal(mode, 'local-mock-no-smtp')
  assert.notEqual(body.sharePoint?.ok, true)
  assert.equal(response.url.includes('?'), false)
  pass('local mock POST confirmed with no query string and no SharePoint write')

  const getResponse = await fetch(
    `${origin}/api/intake?name=QA+TEST&email=qa-test-donotcontact@example.com`,
  )
  assert.equal(getResponse.status, 405)
  pass('GET intake is rejected (fields cannot ride a query string into intake)')
} finally {
  await new Promise((resolve) => server.close(resolve))
}

console.log('All contact form POST checks passed.')
