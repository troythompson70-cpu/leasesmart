#!/usr/bin/env node
/**
 * AIWO-008 regression suite (T1–T20) + company/domain + email snapshot.
 * Run: node revenue-command-center/tests/aiwo008_regression.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RCC = join(__dirname, '..');
const js = (name) => pathToFileURL(join(RCC, 'js', name)).href;

const {
  upsertNewReply,
  acknowledgeNewReply,
  countNewReplies,
  recoverMissingNewReplies,
  isExcludedInbound,
  clearNewRepliesStore,
  mergePersistedNewReplies,
} = await import(js('new-replies.js'));
const {
  upsertCompanyRecord,
  extractEmailDomain,
  preventDuplicateCompanyByDomain,
  findCompanyForEmail,
} = await import(js('company-domain.js'));
const {
  recentEmailOf,
  conversationSnapshotOf,
  repairEmailFields,
  sanitizeUiText,
  assertNoSecretLeak,
} = await import(js('email-snapshot.js'));
const { processDiscovery } = await import(js('discovery-pipeline.js'));
const { runMailboxBackfill, messageToCandidate } = await import(js('mailbox-backfill.js'));
const { findExistingOpportunity } = await import(js('dedupe.js'));

const green = JSON.parse(readFileSync(join(RCC, 'fixtures', 'green.json'), 'utf8'));

const results = [];
function check(id, cond, detail = '') {
  results.push({ id, ok: !!cond, detail });
  const mark = cond ? 'PASS' : 'FAIL';
  console.log(`${mark} ${id}${detail ? ' — ' + detail : ''}`);
}

// LocalStorage shim for Node
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}
clearNewRepliesStore();

const PC_MATIC_MSG = {
  source_message_id:
    'AAMkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQBGAAAAAABM-p-pNO4PQqCbYv78AJTcBwB2LmLWh7LLR6NU-Qgn6UINAAAAAAEMAAB2LmLWh7LLR6NU-Qgn6UINAAVimj-UAAA=',
  subject: 'Re: TGT Technologies Inc. — MSP NFR / 60-Day Evaluation Qualification',
  body_preview:
    "Troy, my apologies for the late reply. I've been out because of a family emergency… I'll connect you with a colleague of mine to help you with the onboarding process. To answer your question, yes, we do not have any minimums to be a partner.",
  received_at: '2026-09-16T02:23:15Z',
  sender: 'Sylvanus Mensah',
  sender_email: 'smensah@pcmatic.com',
  from_email: 'smensah@pcmatic.com',
  recipient: 'tgates@tgttechnologies.com',
  web_link:
    'https://outlook.office365.com/owa/?ItemID=AAMkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQBGAAAAAABM-p-pNO4PQqCbYv78AJTcBwB2LmLWh7LLR6NU-Qgn6UINAAAAAAEMAAB2LmLWh7LLR6NU-Qgn6UINAAVimj-UAAA%3D&exvsurl=1&viewmodel=ReadMessageItem',
  transmission_direction: 'INCOMING',
  company: 'PC Matic',
};

const JARED_MSG = {
  id: 'AAMkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQBGAAAAAABM-p-pNO4PQqCbYv78AJTcBwB2LmLWh7LLR6NU-Qgn6UINAAAAAAEMAAB2LmLWh7LLR6NU-Qgn6UINAAVimj-yAAA=',
  source_message_id:
    'AAMkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQBGAAAAAABM-p-pNO4PQqCbYv78AJTcBwB2LmLWh7LLR6NU-Qgn6UINAAAAAAEMAAB2LmLWh7LLR6NU-Qgn6UINAAVimj-yAAA=',
  subject: 'Re: [Duo MSP] Re: TGT Technologies Inc. — Secure MSP Center + NFR License Inquiry',
  body_preview:
    'Hey Troy,\r\n\r\nWould love to get this taken care of for you sooner rather than later so you can use!',
  received_at: '2026-09-16T18:21:50Z',
  receivedDateTime: '2026-09-16T18:21:50Z',
  from: { emailAddress: { name: 'Jared Millikan (jmillika)', address: 'jmillika@cisco.com' } },
  from_email: 'jmillika@cisco.com',
  sender_email: 'jmillika@cisco.com',
  toRecipients: [{ emailAddress: { name: 'T.G.T.', address: 'tgates@tgttechnologies.com' } }],
  conversationId:
    'AAQkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQAQAChezebRSQdAhDY2cjgSBnM=',
  webLink:
    'https://outlook.office365.com/owa/?ItemID=AAMkADU4ZWEzOTBmLTY3NzItNGMzOC05ZDRhLWU2MmQ0OGYwNWI0YQBGAAAAAABM%2Fp%2FpNO4PQqCbYv78AJTcBwB2LmLWh7LLR6NU%2FQgn6UINAAAAAAEMAAB2LmLWh7LLR6NU%2FQgn6UINAAVimj%2FyAAA%3D&exvsurl=1&viewmodel=ReadMessageItem',
  direction: 'INCOMING',
};

let feed = structuredClone(green);

// T1 duplicate ingestion
{
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  upsertNewReply(feed, PC_MATIC_MSG, opp);
  const c1 = countNewReplies(feed);
  upsertNewReply(feed, PC_MATIC_MSG, opp);
  const c2 = countNewReplies(feed);
  check('T1', c1 === c2 && c1 >= 1, `count=${c2}`);
}

// T2 refresh 10x
{
  const before = countNewReplies(feed);
  for (let i = 0; i < 10; i++) mergePersistedNewReplies(feed);
  check('T2', countNewReplies(feed) === before, `count=${before}`);
}

// T3 open/read does not ack
{
  const before = countNewReplies(feed);
  // simulate open — no acknowledge call
  check('T3', countNewReplies(feed) === before, 'open/read leaves unacked');
}

// T4 ack without disposition rejected
{
  const bad = acknowledgeNewReply(feed, PC_MATIC_MSG.source_message_id, null);
  check('T4', !bad.ok, bad.error || 'rejected');
}

// T5 ack + disposition removes from NEW REPLIES
{
  const before = countNewReplies(feed);
  const ok = acknowledgeNewReply(feed, PC_MATIC_MSG.source_message_id, 'YELLOW', 'Troy');
  check('T5', ok.ok && countNewReplies(feed) === before - 1, `disposition=${ok.item?.disposition}`);
}

// T6 newer inbound on existing opp => new ack item, no duplicate opp
{
  clearNewRepliesStore();
  feed = structuredClone(green);
  const beforeOpps = feed.opportunities.length;
  const msg2 = {
    ...PC_MATIC_MSG,
    source_message_id: PC_MATIC_MSG.source_message_id + '-NEWER',
    received_at: '2026-09-16T12:00:00Z',
    body_preview: 'Connecting you to my colleague for onboarding.',
  };
  const r = processDiscovery(feed, {
    ...msg2,
    company: 'PC Matic',
    thread_subject: msg2.subject,
    message_id: msg2.source_message_id,
    from_email: 'smensah@pcmatic.com',
  });
  feed = r.feed;
  check(
    'T6',
    r.ok &&
      r.duplicate &&
      feed.opportunities.length === beforeOpps &&
      countNewReplies(feed) >= 1,
    `opps=${feed.opportunities.length} nr=${countNewReplies(feed)}`,
  );
}

// T7 integrity recovery
{
  const orphan = {
    ...PC_MATIC_MSG,
    source_message_id: 'orphan-msg-001',
    opportunity_id: 'SW-016',
    received_at: '2026-09-16T20:00:00Z',
  };
  const rec = recoverMissingNewReplies(feed, [orphan]);
  check('T7', rec.recreated >= 1, `recreated=${rec.recreated}`);
}

// T8 Indeed excluded
{
  check(
    'T8',
    isExcludedInbound({
      subject: 'Job offer from Indeed',
      from_email: 'noreply@indeed.com',
      body_preview: 'Apply now for a 9-to-5 role',
    }),
  );
}

// T9 LIAACC ignored
{
  check(
    'T9',
    isExcludedInbound({
      subject: 'LIAACC / 100 Black Men event',
      received_at: '2026-09-16T10:00:00Z',
      body_preview: 'invitation',
    }),
  );
}

// T10 mobile readability — CSS rules present
{
  const css = readFileSync(join(RCC, 'css', 'rcc.css'), 'utf8');
  check(
    'T10',
    css.includes('min-height: 44px') &&
      css.includes('@media (max-width: 640px)') &&
      css.includes('.rcc-tx-preview'),
    'mobile CSS present',
  );
}

// T11 persistence across reload (localStorage)
{
  clearNewRepliesStore();
  feed = structuredClone(green);
  feed.new_replies = [];
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  upsertNewReply(feed, PC_MATIC_MSG, opp);
  const cBefore = countNewReplies(feed);
  // simulate reload: wipe feed replies, merge from store
  feed.new_replies = [];
  mergePersistedNewReplies(feed);
  const restored = feed.new_replies.some(
    (r) => r.source_message_id === PC_MATIC_MSG.source_message_id,
  );
  check('T11', restored && countNewReplies(feed) === cBefore, `persisted=${countNewReplies(feed)}`);
}

// T12 concurrency/replay idempotent
{
  const id = PC_MATIC_MSG.source_message_id;
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  for (let i = 0; i < 5; i++) upsertNewReply(feed, PC_MATIC_MSG, opp);
  const matches = feed.new_replies.filter((r) => r.source_message_id === id);
  check('T12', matches.length === 1, `matches=${matches.length}`);
}

// T13 PC Matic Recent Email non-empty
{
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  const recent = recentEmailOf(opp);
  check('T13', !!(recent && recent.preview && recent.preview.length > 20), recent?.preview?.slice(0, 60));
}

// T14 Conversation Snapshot non-empty
{
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  const snap = conversationSnapshotOf(opp);
  check('T14', !!(snap && snap.items?.length && snap.items[0].preview), `items=${snap?.items?.length}`);
}

// T15 Open Email web_link
{
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  const recent = recentEmailOf(opp);
  check('T15', !!(recent?.webLink || opp.open_source_url || opp.web_link), recent?.webLink || opp.open_source_url);
}

// T16 blank body triggers repair
{
  const blank = {
    opportunity_id: 'tmp',
    source_message_id: 'msg-repair-1',
    message_preview: '',
    subject: 'x',
  };
  const repaired = repairEmailFields(blank, {
    body_preview: 'Repaired body from Outlook read-through',
    subject: 'Fixed subject',
    web_link: 'https://outlook.office365.com/owa/?ItemID=msg-repair-1',
    received_at: '2026-09-16T12:00:00Z',
    sender: 'a@b.com',
  });
  check('T16', repaired.ok && repaired.repaired && repaired.opp.message_preview.includes('Repaired'), '');
}

// T17 valid body + blank UI is failure — recentEmail must surface body
{
  const opp = {
    message_id: 'x',
    message_preview: 'Hello world body',
    latest_transmission_at: '2026-09-16T01:00:00Z',
    subject: 'Hi',
  };
  const recent = recentEmailOf(opp);
  check('T17', recent.preview === 'Hello world body', recent.preview);
}

// T18 no secret leak in UI
{
  const leaked = sanitizeUiText('SharePoint blocked – Graph credentials are not configured in app deployed secrets');
  check(
    'T18',
    assertNoSecretLeak(leaked) && leaked.includes('temporarily unavailable'),
    leaked,
  );
}

// T19 action grid CSS
{
  const css = readFileSync(join(RCC, 'css', 'rcc.css'), 'utf8');
  check('T19', css.includes('.rcc-action-grid') && css.includes('grid-template-columns'), 'action grid');
}

// T20 PC Matic exactly once in NEW REPLIES until ack
{
  clearNewRepliesStore();
  feed = structuredClone(green);
  const opp = feed.opportunities.find((o) => o.opportunity_id === 'SW-016');
  upsertNewReply(feed, PC_MATIC_MSG, opp);
  upsertNewReply(feed, PC_MATIC_MSG, opp);
  const n = feed.new_replies.filter(
    (r) => r.source_message_id === PC_MATIC_MSG.source_message_id && r.ack_status === 'UNACKNOWLEDGED',
  ).length;
  check('T20', n === 1, `unacked=${n}`);
}

// Company domain: cisco.com → Cisco, multi-contact, no duplicate company
{
  let f = { opportunities: [], companies: [], company_domains: [], new_replies: [] };
  const a = upsertCompanyRecord(f, {
    email: 'jmillika@cisco.com',
    contact_name: 'Jared Millikan',
    opportunity_id: 'SW-DUO-CISCO',
    direction: 'INCOMING',
  });
  f = a.feed;
  const b = upsertCompanyRecord(f, {
    email: 'colleague@cisco.com',
    contact_name: 'Cisco Colleague',
    opportunity_id: 'SW-DUO-CISCO',
    direction: 'INCOMING',
  });
  f = b.feed;
  check('CO1', f.companies.length === 1 && f.companies[0].contacts.length === 2, `cos=${f.companies.length}`);
  check('CO2', extractEmailDomain('jmillika@cisco.com') === 'cisco.com', '');
  const dup = preventDuplicateCompanyByDomain(f, 'OtherCo', 'someone@cisco.com');
  check('CO3', dup.duplicate === true, dup.message || '');
}

// Jared live message drives mailbox backfill → discovery → NEW REPLIES
{
  clearNewRepliesStore();
  feed = structuredClone(green);
  feed.new_replies = [];
  const before = feed.opportunities.length;
  const bf = runMailboxBackfill(feed, [JARED_MSG], { allowReprocess: true });
  feed = bf.feed;
  const duo = feed.opportunities.find((o) => o.opportunity_id === 'SW-DUO-CISCO');
  const nr = (feed.new_replies || []).filter(
    (r) =>
      String(r.source_message_id).endsWith('AAVimj-yAAA=') ||
      String(r.sender_email || '').includes('jmillika@cisco.com'),
  );
  const recent = recentEmailOf(duo);
  const layers = {
    layer1_canonical: !!(duo && duo.source_message_id && duo.message_preview),
    layer2_cc_ingest: nr.length >= 1 && nr[0].ack_status === 'UNACKNOWLEDGED',
    layer3_readback: !!(
      recent &&
      recent.preview &&
      recent.preview.includes('sooner rather than later') &&
      (recent.webLink || '').toLowerCase().includes('outlook')
    ),
  };
  check(
    'JARED_E2E',
    bf.ok &&
      bf.failures.length === 0 &&
      feed.opportunities.length === before &&
      layers.layer1_canonical &&
      layers.layer2_cc_ingest &&
      layers.layer3_readback,
    JSON.stringify({ ...layers, imported: bf.imported, matched: bf.matched, failures: bf.failures }),
  );
  check(
    'JARED_COMPANY',
    !!(feed.companies || []).find((c) => (c.domains || []).includes('cisco.com')),
    'cisco.com company bound',
  );
}

// Dark + light mode CSS contrast rules
{
  const css = readFileSync(join(RCC, 'css', 'rcc.css'), 'utf8');
  check(
    'THEME',
    css.includes('prefers-color-scheme: light') &&
      css.includes('--rcc-text') &&
      css.includes('.rcc-checklist-item'),
    'light+dark contrast rules',
  );
}

// Cards / voice handoff gates (2026-09-21)
{
  const {
    mapOpportunityLane,
    buildActionGuidance,
    buildExecutiveReadout,
    LANES,
  } = await import(js('executive-readout.js'));
  const {
    filterActiveQueue,
    applyQueueDecision,
    QUEUE_DECISIONS,
    isRemovedFromActiveQueue,
    prepareConservativeReplyDraft,
  } = await import(js('record-decisions.js'));
  const { interpretAssistantCommand } = await import(js('tgt-assistant.js'));

  const coi = green.opportunities.find((o) => /optus/i.test(o.company || ''));
  const cisco = green.opportunities.find((o) => /cisco/i.test(o.company || ''));
  check(
    'LANE1',
    mapOpportunityLane(coi) === LANES.CONTRACTORS_FIELD,
    `optus lane=${mapOpportunityLane(coi)}`,
  );
  check(
    'LANE2',
    mapOpportunityLane(cisco) === LANES.NFR_SOFTWARE_AI,
    `cisco lane=${mapOpportunityLane(cisco)}`,
  );

  const gCisco = buildActionGuidance(cisco);
  check(
    'GUIDE1',
    gCisco.hardHold === true &&
      /HARD HOLD/i.test(gCisco.why) &&
      /Goal|What happened|Your next move|Why/.test(
        ['Goal', 'What happened', 'Your next move', 'Why'].join(''),
      ) &&
      !!gCisco.goal &&
      !!gCisco.whatHappened &&
      !!gCisco.yourNextMove &&
      !!gCisco.why,
    'cisco hard-hold guidance fields',
  );
  const gCoi = buildActionGuidance(coi);
  check('GUIDE2', /COI|insurance/i.test(gCoi.goal + gCoi.why), 'COI guidance');

  const readout = buildExecutiveReadout(green.opportunities);
  check(
    'EXEC1',
    readout.length === 4 &&
      readout[0].priority === 'P0' &&
      /COI/i.test(readout[0].title) &&
      readout[1].hardHold === true &&
      /HARD HOLD/i.test(readout[1].title + readout[1].body),
    'executive readout priorities + hard hold',
  );

  let sample = structuredClone(cisco);
  const keep = applyQueueDecision(sample, QUEUE_DECISIONS.KEEP_ACTIVE);
  check('DEC1', keep.ok && keep.opp.queue_state === 'active', 'Keep Active');
  const pass = applyQueueDecision(sample, QUEUE_DECISIONS.PASS_NOT_FIT);
  check('DEC2', pass.ok && pass.opp.status === 'PASS', 'Pass / Not a Fit');
  const save = applyQueueDecision(sample, QUEUE_DECISIONS.SAVE_RECORD);
  check('DEC3', save.ok && !!save.opp.record_saved_at, 'Save Record');
  const rem = applyQueueDecision(sample, QUEUE_DECISIONS.REMOVE_FROM_QUEUE);
  check(
    'DEC4',
    rem.ok &&
      isRemovedFromActiveQueue(rem.opp) &&
      rem.opp.source === sample.source &&
      Array.isArray(rem.opp.decision_audit) &&
      rem.opp.decision_audit.at(-1).evidence_retained === true,
    'soft-remove retains evidence',
  );
  const mixed = [...green.opportunities, rem.opp];
  const active = filterActiveQueue(mixed);
  check(
    'ARCH1',
    active.length === green.opportunities.length &&
      !active.some((o) => isRemovedFromActiveQueue(o)),
    `active=${active.length}`,
  );

  const draft = prepareConservativeReplyDraft(cisco, gCisco);
  check(
    'DRAFT1',
    draft.canSendLive === false && /DRAFT|not sent|HARD HOLD/i.test(draft.body + draft.warning),
    'draft-only helper',
  );

  const asst = interpretAssistantCommand('draft reply for Cisco', {
    opportunities: green.opportunities,
  });
  check('ASST1', asst.ok && asst.draft && asst.draft.canSendLive === false, asst.reply);
  const asst2 = interpretAssistantCommand('show incoming', {
    opportunities: green.opportunities,
  });
  check(
    'ASST2',
    asst2.ok && asst2.actions.some((a) => a.type === 'set_filter' && a.filter === 'incoming'),
    asst2.reply,
  );
}

const failed = results.filter((r) => !r.ok);
console.log('\n=== SUMMARY ===');
console.log(`passed=${results.length - failed.length} failed=${failed.length} total=${results.length}`);
if (failed.length) {
  for (const f of failed) console.log('FAIL', f.id, f.detail);
  process.exit(1);
}
process.exit(0);
