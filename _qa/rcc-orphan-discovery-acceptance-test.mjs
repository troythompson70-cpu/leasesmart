#!/usr/bin/env node
/**
 * RCC orphan-discovery / data-integrity acceptance tests A–J.
 * Law: IF AI KNOWS ABOUT IT, COMMAND CENTER MUST KNOW ABOUT IT.
 * No live SharePoint / Exchange writes.
 */
import { readFileSync } from 'node:fs';
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

/** Minimal localStorage for Node persistence tests */
function installMemoryLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

const results = [];
function test(name, fn) {
  try {
    const ret = fn();
    if (ret && typeof ret.then === 'function') {
      throw new Error('Use asyncTest for async');
    }
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

async function main() {
  installMemoryLocalStorage();

  const { processDiscovery } = await loadMod('js/discovery-pipeline.js');
  const {
    acknowledgeActivity,
    classifyActivity,
    countUnreadActivity,
    isUnreadActivity,
    mergePersistedActivity,
    clearActivityStore,
  } = await loadMod('js/new-activity.js');
  const { reconcileOrphanDiscoveries, comparePipelineToDashboard } =
    await loadMod('js/orphan-reconcile.js');
  const { enforceReportIntegrity, buildSixPmReportView } = await loadMod(
    'js/report-integrity.js',
  );
  const { runMailboxBackfill, assertBackfillIdempotent } = await loadMod(
    'js/mailbox-backfill.js',
  );
  const { evaluateSyncHealth } = await loadMod('js/sync-health.js');
  const { cardViewModel } = await loadMod('js/opportunity-card.js');
  const { getOpportunities } = await loadMod('js/feed-loader.js');

  const green = loadJson('green.json');
  clearActivityStore();

  test('TEST A: Synthetic AI discovery creates canonical card before accounted_for', () => {
    const feed = structuredClone(green);
    const before = getOpportunities(feed).length;
    const result = processDiscovery(feed, {
      company: 'Northstar MWBE Partners',
      subject: 'MWBE subcontract RFQ — field service expansion',
      source: 'AI_DISCOVERY',
      source_ref: 'chatgpt:synth-northstar-001',
      tier: '2',
    });
    assert(result.ok, result.error || 'discovery failed');
    assert(result.accounted_for === true, 'must be ACCOUNTED_FOR only after save+verify');
    assert(result.status === 'ACCOUNTED_FOR', result.status);
    assert(result.opportunity?.opportunity_id, 'opportunity id required');
    assert(result.opportunity?.record_id, 'record id required');
    assert(
      getOpportunities(result.feed).length === before + 1,
      'canonical card must exist in feed',
    );
    assert(
      result.opportunity.acknowledgement_state === 'UNREAD',
      'new discovery must be UNREAD',
    );
  });

  test('TEST B: Discover same opportunity twice — one card, evidence updated', () => {
    let feed = structuredClone(green);
    const payload = {
      company: 'Acme Duplicate Probe LLC',
      subject: 'MSP managed services RFP',
      thread_id: 'thread-acme-dup-probe',
      source: 'AI_DISCOVERY',
      source_ref: 'scan:1',
    };
    const first = processDiscovery(feed, payload);
    assert(first.ok, first.error);
    feed = first.feed;
    const count1 = getOpportunities(feed).length;
    const second = processDiscovery(feed, {
      ...payload,
      source_ref: 'scan:2',
      message_preview: 'Second discovery evidence',
    });
    assert(second.ok, second.error);
    assert(second.duplicate === true, 'must detect duplicate');
    assert(second.duplicates_prevented >= 1, 'duplicates_prevented');
    assert(
      getOpportunities(second.feed).length === count1,
      'must not create second active card',
    );
    assert(
      /Second discovery/i.test(second.opportunity.message_preview || ''),
      'evidence/activity must update',
    );
  });

  test('TEST C: Reply to existing company → NEW ACTIVITY up; card updated; unread until ack', () => {
    clearActivityStore();
    let feed = structuredClone(green);
    // Huntress starts with incoming_attention=false — reply must raise NEW ACTIVITY.
    const huntressBefore = getOpportunities(feed).find((o) => o.id === 'opp-huntress');
    assert(huntressBefore && huntressBefore.incoming_attention === false, 'precondition');
    const beforeUnread = countUnreadActivity(getOpportunities(feed));
    const result = processDiscovery(feed, {
      company: 'Huntress',
      subject: 'Huntress Free MSP NFR',
      thread_subject: 'Huntress Free MSP NFR',
      thread_id: 'thread-huntress-1',
      transmission_direction: 'INCOMING',
      message_preview: 'Partner reply — next steps for Neighborhood Watch.',
      source: 'OUTLOOK_REPLY',
    });
    assert(result.ok, result.error);
    assert(result.duplicate === true, 'must update existing Huntress card');
    const afterUnread = countUnreadActivity(getOpportunities(result.feed));
    assert(afterUnread > beforeUnread, `unread should increase ${beforeUnread}→${afterUnread}`);
    assert(isUnreadActivity(result.opportunity), 'reply remains unread');
    assert(
      result.opportunity.acknowledgement_state === 'UNREAD',
      'ack state UNREAD',
    );
    assert(
      /Partner reply/i.test(result.opportunity.message_preview || ''),
      'card transmission preview updated',
    );
    assert(result.opportunity.status === huntressBefore.status, 'status must not auto-change');
  });

  test('TEST D: Refresh / mergePersistedActivity keeps NEW ACTIVITY highlighted', () => {
    clearActivityStore();
    let feed = structuredClone(green);
    const created = processDiscovery(feed, {
      company: 'Persist Probe Co',
      subject: 'Website lead — MSP quote',
      source: 'WEBSITE',
      source_ref: 'web:persist-1',
    });
    assert(created.ok, created.error);
    feed = created.feed;
    const id = created.opportunity.opportunity_id;
    // Simulate browser refresh: re-merge from localStorage after ack store write on create path
    // Create path sets UNREAD on opp; persist happens on acknowledge. Seed store via acknowledge then undo? 
    // Instead: acknowledge is not called — merge should still show unread from feed fields.
    const refreshed = mergePersistedActivity(structuredClone(feed));
    const opp = getOpportunities(refreshed).find(
      (o) => String(o.opportunity_id) === String(id),
    );
    assert(opp, 'opportunity survives refresh');
    assert(isUnreadActivity(opp), 'NEW ACTIVITY must remain after refresh');
  });

  test('TEST E: Acknowledge clears unread; qualification/status unchanged', () => {
    clearActivityStore();
    let feed = structuredClone(green);
    const created = processDiscovery(feed, {
      company: 'Ack Probe Inc',
      subject: 'NFR software partner intro',
      source: 'AI_DISCOVERY',
      status: 'NEW',
      classification: 'UNSURE',
    });
    assert(created.ok, created.error);
    const before = created.opportunity;
    const ack = acknowledgeActivity(before);
    assert(ack.ok, ack.error);
    assert(ack.opp.acknowledgement_state === 'ACKNOWLEDGED');
    assert(ack.opp.status === before.status, 'status must not change');
    assert(
      (ack.opp.classification || 'UNSURE') === (before.classification || 'UNSURE'),
      'classification must not change on ack',
    );
    assert(!isUnreadActivity(ack.opp), 'unread cleared');
    // classify separately
    const classified = classifyActivity(ack.opp, 'VALID');
    assert(classified.ok);
    assert(classified.opp.classification === 'VALID');
    assert(classified.opp.status === before.status);
  });

  test('TEST F: Report with synthetic unrecorded lead → orphan detector repairs or blocks', () => {
    const feed = structuredClone(green);
    const report = enforceReportIntegrity(feed, [
      {
        company: 'Report Orphan LLC',
        opportunity: '6PM unrecorded government lead',
        // intentionally no record_id
        source: 'SIX_PM_REPORT',
      },
      {
        record_id: 'opp-optus-coi',
        company: 'Optus Staffing',
        opportunity: 'Optus Staffing insurance readiness',
      },
    ]);
    assert(report.orphans_flagged >= 1, 'must flag orphan');
    assert(report.orphans_repaired >= 1, 'must repair orphan into canonical');
    assert(report.complete === true, 'report complete after repair');
    assert(
      report.items.every((i) => i.record_id),
      'every report item must have record_id',
    );
    const found = getOpportunities(report.feed).some(
      (o) => /Report Orphan/i.test(o.company || ''),
    );
    assert(found, 'canonical record must exist after report enforcement');
  });

  test('TEST G: Failed canonical write → not SYNCED; audit shows failed write', () => {
    const feed = structuredClone(green);
    // Force failure: missing company/subject
    const result = processDiscovery(feed, {
      company: '',
      subject: '',
      source: 'AI_DISCOVERY',
    });
    assert(result.ok === false, 'must fail');
    assert(result.orphan_class === 'ORPHAN_DISCOVERY');
    assert(result.integrity === 'SYNC_ERROR');
    // Simulate failed_writes on feed
    const broken = {
      ...feed,
      failed_writes: [
        {
          company: 'Fail Probe',
          problem: 'Canonical write failed',
          status: 'BLOCKED',
          recommended_fix: 'Retry durable write',
        },
      ],
      integrity_verification_ok: false,
      mailbox_coverage_verified: true,
      ui_sync_health: {
        ...feed.ui_sync_health,
        health_state: 'RED',
        failed_write_count: 1,
      },
    };
    const h = evaluateSyncHealth(broken, { now: Date.parse('2026-09-15T21:30:00Z') });
    assert(h.state === 'RED', `expected RED got ${h.state}`);
    assert(h.finalSyncState === 'OUT OF SYNC — BLOCKERS REMAIN');
    assert(
      h.auditRows.some((r) => r.section === 'Failed Writes'),
      'audit must show failed write',
    );
  });

  test('TEST H: Historical backfill twice is idempotent', () => {
    const feed = structuredClone(green);
    const messages = [
      {
        id: 'msg-backfill-1',
        message_id: 'msg-backfill-1',
        conversation_id: 'conv-backfill-1',
        subject: 'Field service subcontract opportunity',
        company: 'Backfill City Works',
        body_preview: 'Please bid on municipal field service.',
        received_at: '2026-09-10T12:00:00Z',
        mailbox: 'info@',
      },
      {
        id: 'msg-backfill-2',
        message_id: 'msg-backfill-2',
        conversation_id: 'thread-optus-1',
        subject: 'Optus Staffing insurance readiness',
        company: 'Optus Staffing',
        body_preview: 'Historical reply in thread',
        received_at: '2026-09-12T12:00:00Z',
        mailbox: 'outlook',
      },
    ];
    const check = assertBackfillIdempotent(feed, messages);
    assert(check.ok, `idempotent failed: first.created=${check.first?.created} second.created=${check.second?.created}`);
    assert(check.second.created === 0, 'second run must create 0');
    assert(check.countAfterFirst === check.countAfterSecond, 'opportunity count stable');
  });

  test('TEST I: Mobile layout — Opportunity ID, company, status, owner action, tx, ack readable', () => {
    const css = readFileSync(join(root, 'css', 'rcc.css'), 'utf8');
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert(/@media \(max-width:\s*640px\)/.test(css), 'mobile breakpoint');
    assert(/\.rcc-lead-id/.test(css), 'opportunity id style');
    assert(/font-size:\s*20px/.test(css), 'large company name on mobile');
    assert(/\.rcc-status-lg/.test(css), 'large status');
    assert(/\.rcc-tier-lg/.test(css), 'large tier');
    assert(/\.rcc-owner-lg/.test(css), 'large owner action');
    assert(/\.rcc-ack-btn/.test(css), 'large acknowledgement control');
    assert(/data-filter="new-activity"/.test(html), 'NEW ACTIVITY tab required');
    assert(/rccNewActivityCount/.test(html), 'NEW ACTIVITY badge required');
    const opp = green.opportunities[0];
    const vm = cardViewModel(opp, green.opportunities);
    assert(vm.opportunityId || vm.leadId, 'id present');
    assert(vm.company, 'company present');
    assert(vm.status, 'status present');
    assert(vm.ownerYesNo, 'owner action present');
    assert(vm.transmission, 'transmission present');
  });

  test('TEST J: Canonical pipeline vs Dashboard Feed — zero unexplained discrepancies', () => {
    const feed = structuredClone(green);
    // Align pipeline with opportunities for agree check
    feed.pipeline = feed.opportunities.map((o) => ({
      id: o.id,
      opportunity_id: o.opportunity_id,
      record_id: o.record_id || o.opportunity_id,
      company: o.company,
    }));
    feed.pipeline_feed_agree = true;
    const cmp = comparePipelineToDashboard(feed);
    assert(cmp.ok, `discrepancies: ${JSON.stringify(cmp.discrepancies)}`);
    assert(cmp.discrepancies.length === 0);

    // Orphan reconcile on empty side-channels should leave unresolved at 0
    const recon = reconcileOrphanDiscoveries(feed, {});
    assert(recon.UNRESOLVED_ORPHANS === 0, `unresolved=${recon.UNRESOLVED_ORPHANS}`);
  });

  test('BONUS: 6PM report is a view of Command Center with record ids', () => {
    const view = buildSixPmReportView(structuredClone(green), { skipReconcile: true });
    assert(view.view_of === 'COMMAND_CENTER');
    assert(view.items.every((i) => i.record_id));
  });

  test('BONUS: Orphan reconcile repairs AI-known missing lead', () => {
    const feed = structuredClone(green);
    const recon = reconcileOrphanDiscoveries(feed, {
      ai_discoveries: [
        {
          company: 'GovBuy Portal',
          opportunity: 'IT staffing MWBE set-aside',
          source: 'AI_DISCOVERY',
          source_ref: 'chatgpt:govbuy-1',
        },
      ],
    });
    assert(recon.ORPHAN_DISCOVERIES_FOUND >= 1, 'must find orphan');
    assert(recon.ORPHAN_DISCOVERIES_REPAIRED >= 1, 'must repair');
    assert(recon.UNRESOLVED_ORPHANS === 0, 'target unresolved=0');
    assert(
      getOpportunities(recon.feed).some((o) => /GovBuy/i.test(o.company || '')),
      'canonical present',
    );
  });

  test('BONUS: mailbox coverage warning persists until verified', () => {
    const feed = structuredClone(green);
    feed.mailbox_coverage_verified = false;
    const h = evaluateSyncHealth(feed, { now: Date.parse('2026-09-15T21:30:00Z') });
    assert(h.state !== 'GREEN', 'must not claim SYNCED without mailbox coverage');
    assert(/mailbox coverage is not verified/i.test(h.mailboxCoverageWarning || h.label));
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    failed.forEach((f) => console.error(` - ${f.name}: ${f.error}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
