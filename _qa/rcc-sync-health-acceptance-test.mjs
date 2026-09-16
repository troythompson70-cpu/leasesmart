#!/usr/bin/env node
/**
 * TGT Revenue Command Center — sync-health + revenue-flow UI acceptance / bug test.
 *
 * Two kinds of checks:
 *   (1) PURE MODULE TESTS — import the ES modules directly and assert behavior.
 *       These are robust and are the primary defense.
 *   (2) SOURCE / CONTRACT TESTS — read revenue-command-center/js/app.js as text and
 *       assert the required card + dispatch wiring is present. This catches the class
 *       of regressions that just happened: missing card buttons, buttons that do
 *       nothing, missing card info, and broken email links.
 *
 * Runs Node-side logic against fixtures only. No live SharePoint writes. No deploy.
 * Usage:  node _qa/rcc-sync-health-acceptance-test.mjs
 * Exits non-zero if ANY assertion fails.
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

function readSrc(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function listFixtureFiles() {
  return readdirSync(join(root, 'fixtures'))
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.toLowerCase());
  }
  return out;
}

/* ---- source/contract regex helpers ---- */
const Q = '[\\x27\\x22\\x60]'; // ' " or `
function dataActionRe(name) {
  return new RegExp('data-action\\s*=\\s*' + Q + name + Q);
}
function dispatchBranchRe(name) {
  // matches: action === 'x' | action == 'x' | case 'x' | === "x"
  return new RegExp('(===|==|case)\\s*' + Q + name + Q);
}
function labelRe(name) {
  // Matches a rendered meta label wrapped in markup, allowing a descriptive
  // suffix so "Owner action" also satisfies "Owner action required".
  // e.g. >Tier</dt>, >Last verified</dt>, >Owner action required</dt>
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('>\\s*' + escaped + '[^<]*<');
}
function listenerRe(elementId) {
  return new RegExp(
    elementId + Q + '[\\s\\S]{0,120}?addEventListener\\(\\s*' + Q + 'click' + Q,
  );
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
  /* ---- module imports under test ---- */
  const { evaluateSyncHealth } = await loadMod('js/sync-health.js');
  const { findExistingOpportunity, findDuplicateCollisions } = await loadMod('js/dedupe.js');
  const { saveAndVerify } = await loadMod('js/save-verify.js');
  const { selectOwnerActionPanel, sortOpportunities } = await loadMod('js/sorting.js');
  const { reconcileSoftwareChecklist, parseListSoftwareBody } = await loadMod(
    'js/software-checklist.js',
  );
  const { ACTION_LOCK_MESSAGE, SCHEMA_VERSION } = await loadMod('js/constants.js');
  const {
    leadIdOf,
    hasIncomingAttention,
    clearIncomingAttention,
    buildEmailThreadLink,
    transmissionOf,
  } = await loadMod('js/transmission.js');
  const {
    isMalformedSharePointPath,
    normalizeSharePointPath,
    resolveRecordPath,
    auditMalformedPaths,
    CANONICAL_RCC_ROOT,
  } = await loadMod('js/paths.js');
  const { cardViewModel } = await loadMod('js/opportunity-card.js');

  /* ---- fixtures ---- */
  const green = loadJson('green.json');
  const yellow = loadJson('yellow-stale.json');
  const incomplete = loadJson('yellow-incomplete.json');
  const redWrite = loadJson('red-failed-write.json');
  const redDup = loadJson('red-duplicate.json');
  const redOrphan = loadJson('red-orphan-email.json');

  const nowGreen = Date.parse('2026-09-15T21:30:00Z');
  const nowStale = Date.parse('2026-09-14T20:30:00Z');

  /* =====================================================================
   * SECTION A — transmission.js (Lead ID + latest transmission + email link)
   * ===================================================================== */

  test('transmission.leadIdOf: returns permanent lead_id / opportunity_id', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    assert(leadIdOf(optus) === 'opp-optus-coi', `got ${leadIdOf(optus)}`);
    // falls back to opportunity_id when lead_id absent
    assert(leadIdOf({ opportunity_id: 'X-42' }) === 'X-42', 'opportunity_id fallback');
    // falls back to id when only id present
    assert(leadIdOf({ id: 'only-id' }) === 'only-id', 'id fallback');
    assert(leadIdOf(null) === '', 'null-safe');
  });

  test('transmission.transmissionOf: extracts direction/at/subject/sender/preview/eventId', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const tx = transmissionOf(optus);
    assert(tx, 'transmission must be present');
    assert(tx.direction === 'INCOMING', `direction ${tx.direction}`);
    assert(tx.at === '2026-09-15T18:40:00Z', `at ${tx.at}`);
    assert(/COI/i.test(tx.subject), `subject ${tx.subject}`);
    assert(/optusstaffing/i.test(tx.sender), `sender ${tx.sender}`);
    assert(tx.preview && /COI request/i.test(tx.preview), `preview ${tx.preview}`);
    assert(tx.eventId === 'evt-optus-incoming-0915', `eventId ${tx.eventId}`);
    // OUTBOUND normalization
    const hennge = green.opportunities.find((o) => o.id === 'opp-hennge');
    assert(transmissionOf(hennge).direction === 'OUTBOUND', 'OUTBOUND direction');
    assert(transmissionOf(null) === null, 'null-safe');
  });

  test('transmission.hasIncomingAttention: true when true, false when explicitly false', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const hennge = green.opportunities.find((o) => o.id === 'opp-hennge');
    assert(hasIncomingAttention(optus) === true, 'optus incoming true');
    assert(hasIncomingAttention(hennge) === false, 'hennge explicitly false');
    assert(hasIncomingAttention({ incoming_attention: true }) === true, 'literal true');
    assert(hasIncomingAttention({ incoming_attention: false }) === false, 'literal false');
  });

  test('transmission.buildEmailThreadLink: https href for opp with open_source_url', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const link = buildEmailThreadLink(optus);
    assert(link, 'link must be non-null');
    assert(/^https:\/\//i.test(link.href), `expected https got ${JSON.stringify(link)}`);
  });

  test('transmission.buildEmailThreadLink: non-null link when only a subject is present', () => {
    const link = buildEmailThreadLink({ thread_subject: 'Only a subject here' });
    assert(link && typeof link.href === 'string' && link.href.length > 0, 'subject fallback link');
    assert(/^https:\/\//i.test(link.href), `expected https got ${link && link.href}`);
    // no signal at all → null (do not fabricate a stub)
    assert(buildEmailThreadLink({}) === null, 'empty opp yields null (no stub)');
  });

  test('transmission.clearIncomingAttention: clears attention but PRESERVES business fields', () => {
    const before = structuredClone(green.opportunities.find((o) => o.id === 'opp-optus-coi'));
    const result = clearIncomingAttention(before);
    assert(result.ok, 'clear must succeed');
    assert(result.opp.incoming_attention === false, 'attention cleared to false');
    assert(result.opp.status === before.status, 'status must NOT change');
    assert(result.opp.notes === before.notes, 'notes must be preserved');
    assert(
      result.opp.latest_transmission_at === before.latest_transmission_at,
      'latest_transmission_at must be preserved',
    );
    assert(result.opp.message_preview === before.message_preview, 'message_preview must be preserved');
    // input object must not be mutated (returns a new object)
    assert(before.incoming_attention === true, 'source object must not be mutated');
    assert(clearIncomingAttention(null).ok === false, 'null-safe returns ok:false');
  });

  /* =====================================================================
   * SECTION B — paths.js (malformed Shared Documents detection + canonical)
   * ===================================================================== */

  test('paths.isMalformedSharePointPath: true for doubled Shared Documents', () => {
    assert(
      isMalformedSharePointPath('Shared Documents/Shared Documents/TGT REVENUE COMMAND CENTER'),
      'must detect doubled Shared Documents',
    );
    assert(
      isMalformedSharePointPath('Shared Documents/General/TGT REVENUE COMMAND CENTER') === false,
      'canonical path is NOT malformed',
    );
  });

  test('paths.resolveRecordPath: rejects malformed and returns canonical General root', () => {
    const resolved = resolveRecordPath({
      sharepoint_path: 'Shared Documents/Shared Documents/TGT REVENUE COMMAND CENTER',
    });
    assert(resolved && resolved.malformedRejected === true, 'malformed path must be rejected');
    assert(
      resolved.path === 'Shared Documents/General/TGT REVENUE COMMAND CENTER',
      `canonical fallback expected, got ${resolved.path}`,
    );
    assert(
      CANONICAL_RCC_ROOT === 'Shared Documents/General/TGT REVENUE COMMAND CENTER',
      `CANONICAL_RCC_ROOT ${CANONICAL_RCC_ROOT}`,
    );
    // canonical input passes through
    const ok = resolveRecordPath({ sharepoint_path: CANONICAL_RCC_ROOT + '/00 Lead Intake' });
    assert(typeof ok === 'string' && !isMalformedSharePointPath(ok), 'canonical input preserved');
  });

  test('paths.normalizeSharePointPath: collapses doubled prefix to canonical', () => {
    const normalized = normalizeSharePointPath(
      'Shared Documents/Shared Documents/General/TGT REVENUE COMMAND CENTER',
    );
    assert(
      normalized === 'Shared Documents/General/TGT REVENUE COMMAND CENTER',
      `got ${normalized}`,
    );
  });

  test('paths.auditMalformedPaths: finds the legacy probe in green.json', () => {
    const hits = auditMalformedPaths(green);
    assert(hits.length >= 1, 'green fixture must contain at least one malformed legacy probe');
    assert(
      hits.some((h) => /Shared Documents\/Shared Documents/i.test(h.value)),
      'probe value must be the doubled Shared Documents path',
    );
  });

  /* =====================================================================
   * SECTION C — sync-health.js (GREEN/YELLOW/RED gate)
   * ===================================================================== */

  test('sync-health.evaluateSyncHealth: GREEN for green.json feed, actions unlocked', () => {
    const h = evaluateSyncHealth(green, { now: nowGreen });
    assert(h.state === 'GREEN', `expected GREEN got ${h.state} reasons=${JSON.stringify(h.reasons)}`);
    assert(!h.actionsLocked, 'GREEN must not lock actions');
  });

  test('sync-health.evaluateSyncHealth: RED + action lock on failed write / verification failure', () => {
    const h = evaluateSyncHealth(redWrite, { now: nowGreen });
    assert(h.state === 'RED', `expected RED got ${h.state}`);
    assert(h.actionsLocked === true, 'RED must lock actions');
    assert(ACTION_LOCK_MESSAGE.includes('synchronization'), 'lock message references synchronization');
  });

  test('sync-health.evaluateSyncHealth: stale feed timestamp → YELLOW', () => {
    const h = evaluateSyncHealth(yellow, { now: nowStale });
    assert(h.state === 'YELLOW', `expected YELLOW got ${h.state}`);
  });

  test('sync-health.evaluateSyncHealth: missing health fields → YELLOW incomplete (never GREEN)', () => {
    const h = evaluateSyncHealth(incomplete, { now: nowGreen });
    assert(h.state === 'YELLOW', `expected YELLOW got ${h.state}`);
    assert(
      /incomplete/i.test(h.label) || h.incompleteHealthFields,
      'must signal health verification incomplete',
    );
  });

  test('sync-health.evaluateSyncHealth: duplicate feed → RED and orphan feed → RED w/ audit row', () => {
    const hDup = evaluateSyncHealth(redDup, { now: nowGreen });
    assert(hDup.state === 'RED', `duplicate expected RED got ${hDup.state}`);
    const collisions = findDuplicateCollisions(redDup.opportunities);
    assert(collisions.length >= 1, 'duplicate collision expected');
    const hOrphan = evaluateSyncHealth(redOrphan, { now: nowGreen });
    assert(hOrphan.state === 'RED', `orphan expected RED got ${hOrphan.state}`);
    const orphanRows = hOrphan.auditRows.filter((r) => r.section === 'Orphan Emails');
    assert(orphanRows.length >= 1, 'audit must list the orphan email');
  });

  /* =====================================================================
   * SECTION D — save-verify.js (never a bare "Saved")
   * ===================================================================== */

  test('save-verify.saveAndVerify: SAVED_VERIFIED on a normal patch', () => {
    const r = saveAndVerify(structuredClone(green), 'opp-hennge', {
      status: 'CONTACTED',
      next_action: 'Complete vendor scheduling / qualification',
    });
    assert(r.status === 'SAVED_VERIFIED', `status ${r.status}`);
    assert(r.message === 'SAVED + VERIFIED', `message ${r.message}`);
    assert(r.healthForce === null, 'verified write must not force RED');
  });

  test('save-verify.saveAndVerify: verification-failed status + force RED when read-back fails', () => {
    const r = saveAndVerify(
      structuredClone(green),
      'opp-hennge',
      { status: 'CONTACTED', next_action: 'x' },
      { simulateReadbackFail: true },
    );
    assert(r.status === 'VERIFICATION_FAILED', `status ${r.status}`);
    assert(r.message === 'SAVED — VERIFICATION FAILED', `message ${r.message}`);
    assert(r.healthForce === 'RED', 'failed read-back must force RED');
  });

  /* =====================================================================
   * SECTION E — dedupe / sorting / software-checklist / constants
   * ===================================================================== */

  test('constants: SCHEMA_VERSION is 2.2 and green fixture matches', () => {
    assert(SCHEMA_VERSION === '2.2', `expected 2.2 got ${SCHEMA_VERSION}`);
    assert(green.schema_version === '2.2', `fixture schema ${green.schema_version}`);
  });

  test('dedupe.findExistingOpportunity: matches existing thread — refuses second record', () => {
    const found = findExistingOpportunity(redDup.opportunities, {
      company: 'Acme MSP Tools',
      thread_subject: 'Acme partnership intro',
      thread_id: 'thread-dup-same',
    });
    assert(found.match, 'must find existing active record — refuse to create a duplicate');
  });

  test('sorting.selectOwnerActionPanel: Tier 1 OWNER_ACTION + ACCOUNT_SETUP surface in panel', () => {
    const panel = selectOwnerActionPanel(green.opportunities);
    assert(
      panel.some((o) => o.id === 'opp-optus-coi' && o.status === 'OWNER_ACTION'),
      'Optus OWNER_ACTION missing from owner panel',
    );
    assert(panel.some((o) => o.status === 'ACCOUNT_SETUP'), 'ACCOUNT_SETUP should appear in owner panel');
  });

  test('sorting.sortOpportunities: Tier 1 owner/blocked first, PASS/LOST last', () => {
    const sorted = sortOpportunities(green.opportunities);
    assert(sorted[0].tier === 1, 'first should be tier 1');
    assert(
      ['OWNER_ACTION', 'ACCOUNT_SETUP', 'BLOCKED'].includes(sorted[0].status),
      `expected owner/blocked first got ${sorted[0].status}`,
    );
    assert(sorted[sorted.length - 1].status === 'PASS', 'PASS must sort to the bottom');
  });

  test('software-checklist.reconcile: account evidence overrides stale LIST SOFTWARE setup', () => {
    const list = parseListSoftwareBody(`1 Cisco / Duo MSP Activate NFR/MSP
7 Huntress Complete partner setup
15 Cursor create account`);
    const reconciled = reconcileSoftwareChecklist(
      green.software_checklist?.length ? green.software_checklist : list,
    );
    const cisco = reconciled.find((r) => /cisco/i.test(r.software));
    const huntress = reconciled.find((r) => /huntress/i.test(r.software));
    const cursor = reconciled.find((r) => /cursor/i.test(r.software));
    assert(cisco?.suppressed, 'Cisco setup must be overridden by evidence');
    assert(huntress?.suppressed, 'Huntress setup must be overridden by evidence');
    assert(cursor?.suppressed, 'Cursor new-account must be overridden by evidence');
  });

  /* =====================================================================
   * SECTION F — fixture data integrity (catches "missing card info")
   * ===================================================================== */

  test('fixtures: every opportunity has identity + core display fields', () => {
    for (const file of listFixtureFiles()) {
      const feed = loadJson(file);
      const opps = Array.isArray(feed.opportunities) ? feed.opportunities : [];
      for (const opp of opps) {
        const lead = leadIdOf(opp);
        assert(lead, `${file}: opportunity missing a Lead ID (lead_id/opportunity_id/id)`);
        assert(opp.company || opp.vendor, `${file}:${lead} missing company`);
        assert(opp.status, `${file}:${lead} missing status`);
        assert(opp.last_verified_at, `${file}:${lead} missing last_verified_at`);
        assert(
          opp.source || opp.source_ref || opp.source_evidence,
          `${file}:${lead} missing source evidence`,
        );
        assert(transmissionOf(opp), `${file}:${lead} missing transmission fields`);
      }
    }
  });

  test('fixtures: green.json opportunities carry the FULL schema-2.2 field set', () => {
    for (const opp of green.opportunities) {
      const lead = leadIdOf(opp);
      assert(opp.opportunity_id, `green:${lead} missing opportunity_id`);
      assert(opp.company, `green:${lead} missing company`);
      assert(opp.status, `green:${lead} missing status`);
      assert(opp.last_verified_at, `green:${lead} missing last_verified_at`);
      assert(opp.source, `green:${lead} missing source`);
      assert(opp.next_action, `green:${lead} missing next_action`);
      const tx = transmissionOf(opp);
      assert(tx && tx.direction && tx.at && tx.subject, `green:${lead} incomplete transmission`);
    }
  });

  test('fixtures: at least one fixture has an incoming_attention:true opportunity', () => {
    let count = 0;
    for (const file of listFixtureFiles()) {
      const feed = loadJson(file);
      const opps = Array.isArray(feed.opportunities) ? feed.opportunities : [];
      count += opps.filter((o) => o.incoming_attention === true).length;
    }
    assert(count >= 1, 'expected at least one incoming_attention:true opportunity across fixtures');
    // green itself carries at least two incoming items for the Incoming tab
    const greenIncoming = green.opportunities.filter((o) => hasIncomingAttention(o));
    assert(greenIncoming.length >= 2, `green expected >=2 incoming got ${greenIncoming.length}`);
  });

  test('fixtures: green.json contains the malformed legacy_path_probe for the path audit', () => {
    const probeOpp = green.opportunities.find((o) => o.legacy_path_probe);
    assert(probeOpp, 'green must include an opportunity with legacy_path_probe');
    assert(
      isMalformedSharePointPath(probeOpp.legacy_path_probe),
      `legacy_path_probe must be a malformed path, got ${probeOpp.legacy_path_probe}`,
    );
  });

  /* =====================================================================
   * SECTION G — opportunity-card view model (rendered card data)
   * ===================================================================== */

  test('opportunity-card.cardViewModel: Lead ID equals permanent opportunity_id on every card', () => {
    for (const opp of green.opportunities) {
      const vm = cardViewModel(opp, green.opportunities);
      assert(vm.leadId, 'lead id required on view model');
      assert(
        vm.leadId === String(opp.opportunity_id || opp.id),
        `Lead ID must equal opportunity_id got ${vm.leadId}`,
      );
    }
  });

  test('opportunity-card.cardViewModel: real https email link + transmission + notes', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const vm = cardViewModel(optus, green.opportunities);
    assert(vm.emailLink && /^https:\/\//i.test(vm.emailLink.href), 'email link must be a real https URL');
    assert(vm.transmission && vm.transmission.direction === 'INCOMING', 'transmission on view model');
    assert(/Troy review/i.test(vm.notes), `notes missing: ${vm.notes}`);
    assert(vm.incoming === true, 'incoming flag on view model');
  });

  /* =====================================================================
   * SECTION H — app.js SOURCE / CONTRACT (catches "button missing / does nothing")
   *
   * app.js is being rewritten concurrently. These assertions are written to the
   * agreed CONTRACT the lead agent will honor. Some may FAIL until app.js conforms.
   * ===================================================================== */

  const appSrc = readSrc('js/app.js');

  const CARD_ACTIONS = [
    'open-card',
    'clear-incoming',
    'followup',
    'done',
    'pass',
    'open-sp',
    'repair',
    'delete',
  ];
  for (const action of CARD_ACTIONS) {
    test(`app.js CONTRACT: renders a data-action="${action}" affordance`, () => {
      assert(dataActionRe(action).test(appSrc), `missing data-action="${action}" in app.js`);
    });
  }

  test('app.js CONTRACT: provides an "Open Email Thread" affordance (anchor href or open-source button)', () => {
    assert(/Open Email Thread/.test(appSrc), 'missing "Open Email Thread" affordance label');
    const anchor = /<a[^>]*href\s*=/.test(appSrc);
    const button = dataActionRe('open-source').test(appSrc);
    assert(anchor || button, 'email thread must be an <a href> link or a data-action="open-source" button');
  });

  const META_LABELS = ['Tier', 'Status', 'Last verified', 'Source', 'Owner action', 'Next action'];
  for (const label of META_LABELS) {
    test(`app.js CONTRACT: card meta includes the "${label}" label`, () => {
      assert(labelRe(label).test(appSrc), `card meta missing "${label}" label`);
    });
  }

  test('app.js CONTRACT: each card shows a Lead ID', () => {
    assert(/Lead ID/.test(appSrc), 'card must render a "Lead ID"');
  });

  test('app.js CONTRACT: each card renders a transmission block (rcc-tx)', () => {
    assert(/rcc-tx/.test(appSrc), 'card must render a transmission block with class rcc-tx');
  });

  const DISPATCH_BRANCHES = [
    'open-card',
    'clear-incoming',
    'followup',
    'done',
    'pass',
    'open-source',
    'open-sp',
    'repair',
    'delete',
  ];
  for (const branch of DISPATCH_BRANCHES) {
    test(`app.js CONTRACT: dispatch handles the "${branch}" action`, () => {
      assert(
        dispatchBranchRe(branch).test(appSrc),
        `dispatch (onCardAction/equivalent) has no branch for "${branch}"`,
      );
    });
  }

  test('app.js CONTRACT: click delegation listener attached to #rccCards', () => {
    assert(listenerRe('rccCards').test(appSrc), 'no click listener wired to #rccCards');
  });

  test('app.js CONTRACT: click delegation listener attached to #rccDetailActions', () => {
    assert(listenerRe('rccDetailActions').test(appSrc), 'no click listener wired to #rccDetailActions');
  });

  test('app.js CONTRACT: filter tabs wired for data-filter all / incoming', () => {
    assert(/data-filter/.test(appSrc), 'app.js must read data-filter for the filter tabs');
    assert(new RegExp(Q + 'incoming' + Q).test(appSrc), 'app.js must handle the "incoming" filter');
    assert(new RegExp(Q + 'all' + Q).test(appSrc), 'app.js must handle the "all" filter');
  });

  /* =====================================================================
   * SECTION I — non-negotiables (regression guards)
   * ===================================================================== */

  test('non-negotiable: no second database file introduced under revenue-command-center', () => {
    const files = walk(root);
    const banned = files.filter(
      (f) => f.endsWith('.sqlite') || f.endsWith('.db') || f.includes('nedb'),
    );
    assert(banned.length === 0, `banned db files present: ${banned.join(', ')}`);
  });

  test('non-negotiable: app + path modules never assign the malformed doubled Shared Documents route', () => {
    const scan = ['js/app.js', 'js/paths.js', 'js/constants.js', 'js/opportunity-card.js', 'js/transmission.js'];
    for (const rel of scan) {
      const text = readSrc(rel);
      const lines = text.split('\n').filter((l) => /Shared Documents\/Shared Documents/.test(l));
      for (const line of lines) {
        // detection / rejection strings are allowed; a live SoT assignment is not
        if (
          /=\s*['"`]Shared Documents\/Shared Documents/.test(line) &&
          !/legacy|probe|reject|malformed/i.test(line)
        ) {
          throw new Error(`${rel} still assigns malformed live path: ${line.trim()}`);
        }
      }
    }
  });

  /* ---- summary ---- */
  const failed = results.filter((r) => !r.ok).length;
  const passed = results.length - failed;
  console.log(`\n${passed}/${results.length} PASS`);
  if (failed) {
    console.log('\nFailing assertions:');
    for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}: ${r.error}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL — test harness error (not an assertion):');
  console.error(e);
  process.exit(1);
});
