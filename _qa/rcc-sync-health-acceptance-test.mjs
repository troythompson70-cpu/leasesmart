#!/usr/bin/env node
/**
 * RCC sync-health acceptance tests (TEST 1–10).
 * Runs Node-side logic against fixtures. No live SharePoint writes. No production deploy.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'revenue-command-center');

async function loadMod(rel) {
  return import(pathToFileURL(join(root, rel)).href);
}

function loadJson(name) {
  return JSON.parse(readFileSync(join(root, 'fixtures', name), 'utf8'));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.toLowerCase());
  }
  return out;
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

async function main() {
  const { evaluateSyncHealth } = await loadMod('js/sync-health.js');
  const { findExistingOpportunity, findDuplicateCollisions } = await loadMod('js/dedupe.js');
  const { saveAndVerify } = await loadMod('js/save-verify.js');
  const { selectOwnerActionPanel, sortOpportunities } = await loadMod('js/sorting.js');
  const {
    reconcileSoftwareChecklist,
    parseListSoftwareBody,
  } = await loadMod('js/software-checklist.js');
  const { ACTION_LOCK_MESSAGE } = await loadMod('js/constants.js');

  const green = loadJson('green.json');
  const yellow = loadJson('yellow-stale.json');
  const incomplete = loadJson('yellow-incomplete.json');
  const redWrite = loadJson('red-failed-write.json');
  const redDup = loadJson('red-duplicate.json');
  const redOrphan = loadJson('red-orphan-email.json');

  const nowGreen = Date.parse('2026-09-14T20:30:00Z');
  const nowStale = Date.parse('2026-09-14T20:30:00Z');

  test('TEST 1: Feed current + no errors → GREEN', () => {
    const h = evaluateSyncHealth(green, { now: nowGreen });
    assert(h.state === 'GREEN', `expected GREEN got ${h.state} reasons=${JSON.stringify(h.reasons)}`);
    assert(!h.actionsLocked, 'GREEN must not lock actions');
  });

  test('TEST 2: Set feed timestamp stale → YELLOW', () => {
    const h = evaluateSyncHealth(yellow, { now: nowStale });
    assert(h.state === 'YELLOW', `expected YELLOW got ${h.state}`);
  });

  test('TEST 2b: Missing health fields → YELLOW incomplete (never fabricate GREEN)', () => {
    const h = evaluateSyncHealth(incomplete, { now: nowGreen });
    assert(h.state === 'YELLOW', `expected YELLOW got ${h.state}`);
    assert(
      /incomplete/i.test(h.label) || h.incompleteHealthFields,
      'must signal health verification incomplete',
    );
  });

  test('TEST 3: Simulate failed write → RED and action lock', () => {
    const h = evaluateSyncHealth(redWrite, { now: nowGreen });
    assert(h.state === 'RED', `expected RED got ${h.state}`);
    assert(h.actionsLocked === true, 'actions must lock');
    assert(ACTION_LOCK_MESSAGE.includes('synchronization'), 'lock message present');
  });

  test('TEST 4: Simulate duplicate opportunity → duplicate warning, no second record', () => {
    const h = evaluateSyncHealth(redDup, { now: nowGreen });
    assert(h.state === 'RED', `expected RED got ${h.state}`);
    const collisions = findDuplicateCollisions(redDup.opportunities);
    assert(collisions.length >= 1, 'expected collision');
    const found = findExistingOpportunity(redDup.opportunities, {
      company: 'Acme MSP Tools',
      thread_subject: 'Acme partnership intro',
      thread_id: 'thread-dup-same',
    });
    assert(found.match, 'must find existing — refuse create');
  });

  test('TEST 5: Simulate orphan email → RED and audit drawer shows it', () => {
    const h = evaluateSyncHealth(redOrphan, { now: nowGreen });
    assert(h.state === 'RED', `expected RED got ${h.state}`);
    const orphanRows = h.auditRows.filter((r) => r.section === 'Orphan Emails');
    assert(orphanRows.length >= 1, 'audit must list orphan email');
  });

  test('TEST 6: Successful write + successful read-back → SAVED + VERIFIED', () => {
    const r = saveAndVerify(structuredClone(green), 'opp-hennge', {
      status: 'CONTACTED',
      next_action: 'Complete vendor scheduling / qualification',
    });
    assert(r.message === 'SAVED + VERIFIED', `got ${r.message}`);
    assert(r.status === 'SAVED_VERIFIED', r.status);
  });

  test('TEST 7: Successful write + failed read-back → VERIFICATION FAILED + RED', () => {
    const r = saveAndVerify(
      structuredClone(green),
      'opp-hennge',
      { status: 'CONTACTED', next_action: 'x' },
      { simulateReadbackFail: true },
    );
    assert(r.message === 'SAVED — VERIFICATION FAILED', `got ${r.message}`);
    assert(r.healthForce === 'RED', 'must force RED');
  });

  test('TEST 8: Tier 1 OWNER_ACTION appears in red panel', () => {
    const panel = selectOwnerActionPanel(green.opportunities);
    assert(
      panel.some((o) => o.id === 'opp-optus-coi' && o.status === 'OWNER_ACTION'),
      'Optus OWNER_ACTION missing from panel',
    );
    assert(
      panel.some((o) => o.status === 'ACCOUNT_SETUP'),
      'ACCOUNT_SETUP should appear in owner panel',
    );
  });

  test('TEST 9: Cisco/Huntress/Cursor evidence overrides LIST SOFTWARE setup', () => {
    const list = parseListSoftwareBody(`1 Cisco / Duo MSP Activate NFR/MSP
7 Huntress Complete partner setup
15 Cursor create account`);
    const reconciled = reconcileSoftwareChecklist(
      green.software_checklist?.length ? green.software_checklist : list,
    );
    const cisco = reconciled.find((r) => /cisco/i.test(r.software));
    const huntress = reconciled.find((r) => /huntress/i.test(r.software));
    const cursor = reconciled.find((r) => /cursor/i.test(r.software));
    assert(cisco?.suppressed, 'Cisco setup must be overridden');
    assert(huntress?.suppressed, 'Huntress setup must be overridden');
    assert(cursor?.suppressed, 'Cursor new account must be overridden');
  });

  test('TEST 10: Mobile layout CSS has no horizontal-scroll intent (overflow-x hidden + 2-col metrics)', () => {
    const css = readFileSync(join(root, 'css', 'rcc.css'), 'utf8');
    assert(/overflow-x:\s*hidden/.test(css), 'body must hide horizontal overflow');
    assert(/@media \(max-width:\s*640px\)/.test(css), 'mobile breakpoint required');
    assert(/grid-template-columns:\s*repeat\(2/.test(css), 'mobile 2-col metrics');
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert(/viewport-fit=cover/.test(html), 'viewport meta for iPhone');
  });

  test('BONUS: Dashboard sorting puts PASS/LOST at bottom; Tier1 owner first', () => {
    const sorted = sortOpportunities(green.opportunities);
    assert(sorted[0].tier === 1, 'first should be tier 1');
    assert(
      ['OWNER_ACTION', 'ACCOUNT_SETUP', 'BLOCKED'].includes(sorted[0].status),
      `expected owner/blocked first got ${sorted[0].status}`,
    );
    assert(sorted[sorted.length - 1].status === 'PASS', 'PASS at bottom');
  });

  test('NON-NEGOTIABLE: no second database files introduced under rcc', () => {
    const files = walk(root);
    const banned = files.filter(
      (f) => f.endsWith('.sqlite') || f.endsWith('.db') || f.includes('nedb'),
    );
    assert(banned.length === 0, `banned db files: ${banned.join(',')}`);
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
