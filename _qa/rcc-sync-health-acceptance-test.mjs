#!/usr/bin/env node
/**
 * RCC sync-health + revenue-flow UI gate acceptance tests.
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
  const { selectOwnerActionPanel, sortOpportunities, activityTimestamp } = await loadMod('js/sorting.js');
  const {
    reconcileSoftwareChecklist,
    parseListSoftwareBody,
  } = await loadMod('js/software-checklist.js');
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
    auditMalformedPaths,
    CANONICAL_RCC_ROOT,
  } = await loadMod('js/paths.js');
  const { cardViewModel } = await loadMod('js/opportunity-card.js');
  const { saveUiState, loadUiState, clearUiState, saveFeedCache, loadFeedCache, clearFeedCache } = await loadMod('js/ui-persist.js');
  const { stabilizeIncomingList, resetIncomingBuffer } = await loadMod('js/new-activity.js');

  const green = loadJson('green.json');
  const yellow = loadJson('yellow-stale.json');
  const incomplete = loadJson('yellow-incomplete.json');
  const redWrite = loadJson('red-failed-write.json');
  const redDup = loadJson('red-duplicate.json');
  const redOrphan = loadJson('red-orphan-email.json');

  const nowGreen = Date.parse('2026-09-15T21:30:00Z');
  const nowStale = Date.parse('2026-09-14T20:30:00Z');

  test('SCHEMA: constants declare 2.2 and green fixture matches', () => {
    assert(SCHEMA_VERSION === '2.2', `expected 2.2 got ${SCHEMA_VERSION}`);
    assert(green.schema_version === '2.2', `fixture schema ${green.schema_version}`);
  });

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

  test('TEST 10: Mobile layout CSS — overflow-x hidden, compact health, gate dismissible/hidden', () => {
    const css = readFileSync(join(root, 'css', 'rcc.css'), 'utf8');
    assert(/overflow-x:\s*hidden/.test(css), 'body must hide horizontal overflow');
    assert(/@media \(max-width:\s*640px\)/.test(css), 'mobile breakpoint required');
    assert(
      /Compact sticky health strip/.test(css) || /\.rcc-health-metrics\s*\{[^}]*flex/.test(css),
      'mobile health metrics must be compact',
    );
    assert(/\.rcc-lead-id/.test(css), 'Lead ID styles required');
    assert(/\.rcc-tx/.test(css), 'transmission styles required');
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert(/viewport-fit=cover/.test(html), 'viewport meta for iPhone');
    assert(/id="rccGate"[^>]*\bhidden\b/.test(html), 'gate must be hidden by default');
    assert(/rcc-notes-block/.test(html), 'Notes block near top of opened card');
    assert(/data-filter="incoming"/.test(html), 'Incoming tab required');
  });

  test('FLOW 1: Lead ID is permanent opportunity_id on every card view-model', () => {
    for (const opp of green.opportunities) {
      const vm = cardViewModel(opp, green.opportunities);
      assert(vm.leadId, 'lead id required');
      assert(
        vm.leadId === String(opp.opportunity_id || opp.id),
        `Lead ID must equal opportunity_id got ${vm.leadId}`,
      );
      assert(leadIdOf(opp) === vm.leadId);
    }
  });

  test('FLOW 2: Email/thread link is a real https URL (not toast-only stub)', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const link = buildEmailThreadLink(optus);
    assert(link && /^https:\/\//i.test(link.href), `expected https link got ${JSON.stringify(link)}`);
  });

  test('FLOW 3: Latest transmission rendered under timestamp fields', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const tx = transmissionOf(optus);
    assert(tx.direction === 'INCOMING', tx.direction);
    assert(tx.at, 'timestamp required');
    assert(/COI/i.test(tx.subject), tx.subject);
    assert(tx.preview, 'preview required');
    assert(tx.eventId, 'event id required');
  });

  test('FLOW 4: Notes present for opened-card top placement', () => {
    const optus = green.opportunities.find((o) => o.id === 'opp-optus-coi');
    const vm = cardViewModel(optus, green.opportunities);
    assert(/Troy review/i.test(vm.notes), `notes missing: ${vm.notes}`);
  });

  test('FLOW 5: Incoming filter uses incoming_attention', () => {
    const incoming = green.opportunities.filter((o) => hasIncomingAttention(o));
    assert(incoming.length >= 2, `expected >=2 incoming got ${incoming.length}`);
    assert(incoming.every((o) => o.incoming_attention === true));
  });

  test('FLOW 6: Clear Incoming does not change status or delete correspondence', () => {
    const before = structuredClone(green.opportunities.find((o) => o.id === 'opp-optus-coi'));
    const result = clearIncomingAttention(before);
    assert(result.ok, 'clear must succeed');
    assert(result.opp.incoming_attention === false, 'attention cleared');
    assert(result.opp.status === before.status, 'status must not change');
    assert(result.opp.notes === before.notes, 'notes must remain');
    assert(result.opp.latest_transmission_at === before.latest_transmission_at, 'tx retained');
    assert(result.opp.message_preview === before.message_preview, 'preview retained');
    assert(result.opp.open_source_url === before.open_source_url, 'email link retained');
    assert(result.opp.lead_id === before.lead_id, 'lead id retained');
  });

  test('FLOW 7: Malformed Shared Documents/Shared Documents path detected + normalized', () => {
    assert(
      isMalformedSharePointPath('Shared Documents/Shared Documents/TGT REVENUE COMMAND CENTER'),
      'must detect doubled Shared Documents',
    );
    const normalized = normalizeSharePointPath(
      'Shared Documents/Shared Documents/General/TGT REVENUE COMMAND CENTER',
    );
    assert(
      normalized === 'Shared Documents/General/TGT REVENUE COMMAND CENTER',
      `got ${normalized}`,
    );
    const hits = auditMalformedPaths(green);
    assert(hits.length >= 1, 'green fixture should include one legacy probe for audit');
    assert(CANONICAL_RCC_ROOT.includes('General/TGT REVENUE COMMAND CENTER'));
  });

  test('BONUS: Dashboard sorting is Newest First; PASS/LOST at bottom', () => {
    const sorted = sortOpportunities(green.opportunities);
    const open = sorted.filter((o) => o.status !== 'PASS' && o.status !== 'LOST' && o.status !== 'WON');
    for (let i = 1; i < open.length; i += 1) {
      const prev = activityTimestamp(open[i - 1]);
      const cur = activityTimestamp(open[i]);
      assert(prev >= cur, `open items must be newest first ${open[i - 1].id} ${prev} vs ${open[i].id} ${cur}`);
    }
    assert(sorted[sorted.length - 1].status === 'PASS', 'PASS at bottom');
  });

  test('PERSIST: UI filter and selected lead survive storage reload', () => {
    const mem = new Map();
    globalThis.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
    saveUiState({ filter: 'incoming', openOppId: 'opp-optus-coi', fixtureKey: 'green' });
    const loaded = loadUiState();
    assert(loaded.filter === 'incoming', loaded.filter);
    assert(loaded.openOppId === 'opp-optus-coi', loaded.openOppId);
    saveFeedCache({ opportunities: [{ opportunity_id: 'opp-optus-coi', status: 'OWNER_ACTION' }] }, 'green');
    const cached = loadFeedCache();
    assert(cached.feed.opportunities[0].opportunity_id === 'opp-optus-coi', 'cached lead survives storage');
    clearUiState();
    clearFeedCache();
    assert(loadUiState().filter === 'all', 'cleared state returns default filter');
    assert(loadFeedCache() === null, 'cleared feed cache is empty');
  });

  test('INCOMING BUFFER: existing order stays put when timestamps update', () => {
    resetIncomingBuffer();
    const a = {
      opportunity_id: 'lead-a',
      incoming_attention: true,
      latest_transmission_at: '2026-01-01T00:00:00Z',
    };
    const b = {
      opportunity_id: 'lead-b',
      incoming_attention: true,
      latest_transmission_at: '2026-01-02T00:00:00Z',
    };
    const first = stabilizeIncomingList([a, b]);
    assert(first[0].opportunity_id === 'lead-b', 'newcomers start newest first');
    const aHot = { ...a, latest_transmission_at: '2026-06-01T00:00:00Z' };
    const second = stabilizeIncomingList([aHot, b]);
    assert(second.map((o) => o.opportunity_id).join(',') === 'lead-b,lead-a', second.map((o) => o.opportunity_id).join(','));
    const c = {
      opportunity_id: 'lead-c',
      incoming_attention: true,
      latest_transmission_at: '2026-07-01T00:00:00Z',
    };
    const third = stabilizeIncomingList([aHot, b, c]);
    assert(third[0].opportunity_id === 'lead-c', 'new packet prepends');
    assert(third[1].opportunity_id === 'lead-b', 'prior order locked');
  });

  test('NON-NEGOTIABLE: no second database files introduced under rcc', () => {
    const files = walk(root);
    const banned = files.filter(
      (f) => f.endsWith('.sqlite') || f.endsWith('.db') || f.includes('nedb'),
    );
    assert(banned.length === 0, `banned db files: ${banned.join(',')}`);
  });

  test('NON-NEGOTIABLE: app source has no live malformed Shared Documents route assignment', () => {
    const files = [
      'js/app.js',
      'js/paths.js',
      'js/constants.js',
      'js/opportunity-card.js',
      'js/transmission.js',
      'index.html',
      'feeds/README.md',
    ];
    for (const rel of files) {
      const text = readFileSync(join(root, rel), 'utf8');
      // Detection strings are allowed; live SoT assignment of the doubled path is not.
      const lines = text.split('\n').filter((l) => /Shared Documents\/Shared Documents/.test(l));
      for (const line of lines) {
        if (/=\s*['"`]Shared Documents\/Shared Documents/.test(line) && !/legacy|probe|reject|malformed/i.test(line)) {
          throw new Error(`${rel} still assigns malformed live path: ${line.trim()}`);
        }
      }
    }
  });

  {
    const { loadLiveDashboardFeed, applyNewestFirst } = await loadMod('js/feed-loader.js');
    const loaded = await loadLiveDashboardFeed('');
    test('live dashboard feed fails closed without a Graph proxy URL', () => {
      assert(!loaded.ok, 'live feed must not succeed without proxy');
      assert(String(loaded.error).includes('10 Dashboard Feed'), loaded.error);
      assert(String(loaded.error).includes('GRAPH_CLIENT_SECRET'), loaded.error);
    });
    test('BONUS: applyNewestFirst sorts records Newest First', () => {
      const out = applyNewestFirst({
        records: [
          { record_id: 'old', created_at: '2026-01-01T00:00:00Z', status: 'NEW' },
          { record_id: 'new', created_at: '2026-09-01T00:00:00Z', status: 'NEW' },
        ],
      });
      assert(out.records[0].record_id === 'new', out.records[0].record_id);
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
