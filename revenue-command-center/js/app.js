import { HEALTH, ACTION_LOCK_MESSAGE } from './constants.js';
import { loadFeedFromUrl, getOpportunities } from './feed-loader.js';
import { evaluateSyncHealth, formatMetric } from './sync-health.js';
import { sortOpportunities, selectOwnerActionPanel } from './sorting.js';
import { findExistingOpportunity } from './dedupe.js';
import {
  reconcileSoftwareChecklist,
  parseListSoftwareBody,
} from './software-checklist.js';
import { saveAndVerify } from './save-verify.js';
import {
  cardBadges,
  cardSyncState,
  replyTimingMessage,
  ownerActionYesNo,
} from './opportunity-card.js';

const FIXTURES = {
  green: './fixtures/green.json',
  'yellow-stale': './fixtures/yellow-stale.json',
  'yellow-incomplete': './fixtures/yellow-incomplete.json',
  'red-failed-write': './fixtures/red-failed-write.json',
  'red-duplicate': './fixtures/red-duplicate.json',
  'red-orphan-email': './fixtures/red-orphan-email.json',
};

/** LIST SOFTWARE body excerpt (Outlook 2026-09-14) for checklist reconciliation demos. */
const LIST_SOFTWARE_BODY = `ONE MASTER LIST — Everything You Need to Do
1 Cisco / Duo MSP Activate NFR/MSP
2 Chinron Accept admin invite
3 Malwarebytes Techbench Complete application/setup
7 Huntress Complete partner setup
15 Cursor AI Troy/TGT automation create account`;

const state = {
  feed: null,
  health: null,
  loadError: null,
  fixtureKey: 'green',
  dismissedAudits: new Map(),
  repairLog: [],
};

function $(id) {
  return document.getElementById(id);
}

function toast(message, fail = false) {
  const el = $('rccToast');
  el.textContent = message;
  el.classList.toggle('fail', !!fail);
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), 3500);
}

function setLocked(locked) {
  document.querySelectorAll('[data-lockable="1"]').forEach((btn) => {
    btn.disabled = locked;
    btn.classList.toggle('is-locked', locked);
    if (locked) btn.title = ACTION_LOCK_MESSAGE;
    else btn.removeAttribute('title');
  });
  const banner = $('rccLockBanner');
  banner.classList.toggle('on', locked);
  banner.textContent = locked ? ACTION_LOCK_MESSAGE : '';
}

function renderHealth() {
  const h = state.health;
  const bar = $('rccHealthBar');
  if (!h) return;
  bar.className = `rcc-health ${h.state}`;
  $('rccHealthTitle').textContent = `${h.state} — ${h.label}`;
  $('mLastVerified').textContent = h.lastVerifiedAt || '—';
  $('mFeedUpdated').textContent = h.feedUpdatedAt || '—';
  $('mOrphanEmail').textContent = formatMetric(h.metrics.orphan_email_count);
  $('mOrphanRecord').textContent = formatMetric(h.metrics.orphan_record_count);
  $('mDuplicate').textContent = formatMetric(h.metrics.duplicate_count);
  $('mInvalidRoute').textContent = formatMetric(h.metrics.invalid_route_count);
  $('mFailedWrite').textContent = formatMetric(h.metrics.failed_write_count);
  $('mStale').textContent = formatMetric(h.metrics.stale_record_count);
  setLocked(!!h.actionsLocked);
}

function renderOwnerPanel() {
  const panel = $('rccOwnerPanel');
  const list = $('rccOwnerList');
  const items = selectOwnerActionPanel(getOpportunities(state.feed));
  if (!items.length) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  panel.style.display = 'block';
  list.innerHTML = items
    .map(
      (o) => `<div class="rcc-owner-item">
      <strong>${esc(o.company || o.vendor)}</strong>
      <div>Status: ${esc(o.status)} · Category: ${esc(o.owner_action_category || 'other')}</div>
      <div>Next: ${esc(o.next_action || '—')}</div>
    </div>`,
    )
    .join('');
}

function renderCards() {
  const host = $('rccCards');
  const opps = sortOpportunities(getOpportunities(state.feed));
  if (!opps.length) {
    host.innerHTML = '<p class="rcc-section-title">No opportunities in feed.</p>';
    return;
  }
  host.innerHTML = opps
    .map((opp) => {
      const badges = cardBadges(opp, opps)
        .map((b) => `<span class="rcc-badge ${b.type}">${esc(b.label)}</span>`)
        .join('');
      const sync = cardSyncState(opp);
      const timing = replyTimingMessage(opp);
      const id = opp.id || opp.opportunity_id;
      return `<article class="rcc-card" data-opp-id="${esc(id)}">
        <h3>${esc(opp.company || opp.vendor || 'Opportunity')}</h3>
        <div class="rcc-badges">${badges}<span class="rcc-badge OK">Sync: ${esc(sync)}</span></div>
        <dl class="rcc-card-meta">
          <div><dt>Tier</dt><dd>${esc(opp.tier)}</dd></div>
          <div><dt>Status</dt><dd>${esc(opp.status)}</dd></div>
          <div><dt>Last verified</dt><dd>${esc(opp.last_verified_at || '—')}</dd></div>
          <div><dt>Source</dt><dd>${esc(opp.source || opp.source_ref || '—')}</dd></div>
          <div><dt>Owner action required</dt><dd>${esc(ownerActionYesNo(opp))}</dd></div>
          <div><dt>Next action</dt><dd>${esc(opp.next_action || '—')}</dd></div>
        </dl>
        ${timing ? `<div class="rcc-timing">${esc(timing)}</div>` : ''}
        <div class="rcc-card-actions">
          <button type="button" class="rcc-btn" data-lockable="1" data-action="followup" data-id="${esc(id)}">Send Follow-up</button>
          <button type="button" class="rcc-btn" data-lockable="1" data-action="done" data-id="${esc(id)}">Mark Done</button>
          <button type="button" class="rcc-btn" data-lockable="1" data-action="pass" data-id="${esc(id)}">Close/Pass</button>
          <button type="button" class="rcc-btn" data-action="open-source" data-id="${esc(id)}">Open Source Email</button>
          <button type="button" class="rcc-btn" data-action="open-sp" data-id="${esc(id)}">Open SharePoint Record</button>
          <button type="button" class="rcc-btn" data-action="repair" data-id="${esc(id)}">Repair Record</button>
        </div>
      </article>`;
    })
    .join('');
}

function renderChecklist() {
  const host = $('rccChecklist');
  const fromFeed = state.feed?.software_checklist;
  const base = fromFeed?.length
    ? fromFeed
    : parseListSoftwareBody(LIST_SOFTWARE_BODY);
  const rows = reconcileSoftwareChecklist(base);
  host.innerHTML = rows
    .map(
      (r) => `<div class="rcc-checklist-item ${r.suppressed ? 'suppressed' : ''}">
      <div><strong>${esc(r.software || r.vendor)}</strong><div>${esc(r.displayAction)}</div></div>
      ${r.suppressed ? '<div class="ovr">EVIDENCE OVERRIDE</div>' : ''}
    </div>`,
    )
    .join('');
}

function renderAuditDrawer() {
  const host = $('rccAuditSections');
  const rows = (state.health?.auditRows || []).filter(
    (r) => !state.dismissedAudits.has(r.id),
  );
  const sections = [
    'Orphan Emails',
    'Orphan Records',
    'Duplicate Threads',
    'Stale Statuses',
    'Failed Writes',
    'Invalid/Bounced Routes',
    'Missing Source Evidence',
    'Owner Actions Not Closed',
    'Software Checklist Mismatches',
  ];
  host.innerHTML = sections
    .map((section) => {
      const items = rows.filter((r) => r.section === section);
      const body = items.length
        ? items
            .map(
              (r) => `<div class="rcc-audit-row">
            <strong>${esc(r.company)}</strong>
            <div>Problem: ${esc(r.problem)}</div>
            <div>Source: ${esc(r.source)}</div>
            <div>Status: ${esc(r.status)}</div>
            <div>Fix: ${esc(r.recommended_fix)}</div>
            <div class="rcc-card-actions">
              <button type="button" class="rcc-btn" data-audit="open-source" data-id="${esc(r.id)}">Open Source</button>
              <button type="button" class="rcc-btn" data-audit="repair" data-id="${esc(r.id)}">Repair</button>
              <button type="button" class="rcc-btn" data-audit="dismiss" data-id="${esc(r.id)}">Dismiss with reason</button>
            </div>
          </div>`,
            )
            .join('')
        : '<p style="font-size:12px;color:#93a4b5">None</p>';
      return `<div class="rcc-audit-section"><h3>${esc(section)}</h3>${body}</div>`;
    })
    .join('');
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recompute(runtime = {}) {
  if (!state.feed) {
    state.health = evaluateSyncHealth(null, {
      feedReadable: false,
      feedError: state.loadError || 'Dashboard Feed cannot be read',
      runtime,
    });
  } else {
    state.health = evaluateSyncHealth(state.feed, { runtime });
  }
  if (runtime.verificationFailed || runtime.unverifiedFailedWrite) {
    state.health = {
      ...state.health,
      state: HEALTH.RED,
      label: 'SYSTEM OUT OF SYNC — REVIEW AUDIT BEFORE ACTING',
      actionsLocked: true,
      reasons: [
        ...(state.health.reasons || []),
        runtime.verificationFailed
          ? 'Write succeeded but read-back verification failed'
          : 'A write failed and was not verified',
      ],
    };
  }
  renderHealth();
  renderOwnerPanel();
  renderCards();
  renderChecklist();
  renderAuditDrawer();
}

async function loadFixture(key) {
  state.fixtureKey = key;
  const url = FIXTURES[key];
  const loaded = await loadFeedFromUrl(url);
  if (!loaded.ok) {
    state.feed = null;
    state.loadError = loaded.error;
  } else {
    state.feed = loaded.feed;
    state.loadError = null;
  }
  recompute();
}

function openDrawer(on) {
  $('rccDrawer').classList.toggle('on', on);
  $('rccDrawerBackdrop').classList.toggle('on', on);
}

function openExistingModal(opp) {
  const m = $('rccExistingModal');
  $('rccExistingBody').innerHTML = `
    <p><strong>Company:</strong> ${esc(opp.company || opp.vendor)}</p>
    <p><strong>Status:</strong> ${esc(opp.status)}</p>
    <p><strong>Last action:</strong> ${esc(opp.last_action || '—')}</p>
    <p><strong>Next action:</strong> ${esc(opp.next_action || '—')}</p>
    <p><strong>Most recent email:</strong> ${esc(opp.most_recent_email || '—')}</p>
  `;
  m.dataset.oppId = opp.id || opp.opportunity_id;
  $('rccModalBackdrop').classList.add('on');
}

function closeModal() {
  $('rccModalBackdrop').classList.remove('on');
}

function guardLockedAction() {
  if (state.health?.actionsLocked) {
    toast(ACTION_LOCK_MESSAGE, true);
    return true;
  }
  return false;
}

function onCardAction(action, id) {
  if (['followup', 'done', 'pass', 'bulk'].includes(action) && guardLockedAction()) {
    return;
  }
  if (action === 'followup' || action === 'done' || action === 'pass') {
    const patch =
      action === 'done'
        ? { status: 'WON', next_action: 'Closed' }
        : action === 'pass'
          ? { status: 'PASS', next_action: 'Passed' }
          : { last_action: 'Follow-up queued (manual — no auto-send)', next_action: 'Await reply' };
    const result = saveAndVerify(state.feed, id, patch, {
      simulateReadbackFail: false,
    });
    state.feed = result.feed;
    toast(result.message, result.status !== 'SAVED_VERIFIED');
    recompute(
      result.status === 'VERIFICATION_FAILED'
        ? { verificationFailed: true }
        : {},
    );
    return;
  }
  if (action === 'open-source' || action === 'open-sp') {
    toast(action === 'open-source' ? 'Open Source Email (read-only link)' : 'Open SharePoint Record (SoT)');
    return;
  }
  if (action === 'repair') {
    state.repairLog.push({
      at: new Date().toISOString(),
      opportunityId: id,
      action: 'repair',
      note: 'Repair initiated from UI — auditable',
    });
    toast('Repair logged (auditable). Reconcile against SharePoint SoT.');
  }
}

function wireEvents() {
  $('rccFixtureSelect').addEventListener('change', (e) => {
    loadFixture(e.target.value);
  });
  $('rccOpenAudit').addEventListener('click', () => openDrawer(true));
  $('rccCloseAudit').addEventListener('click', () => openDrawer(false));
  $('rccDrawerBackdrop').addEventListener('click', () => openDrawer(false));
  $('rccRefresh').addEventListener('click', () => loadFixture(state.fixtureKey));
  $('rccCreateOpp').addEventListener('click', () => {
    if (guardLockedAction()) return;
    const company = prompt('Company name?');
    if (!company) return;
    const subject = prompt('Thread subject?') || '';
    const threadId = prompt('Message/thread ID?') || '';
    const found = findExistingOpportunity(getOpportunities(state.feed), {
      company,
      thread_subject: subject,
      thread_id: threadId,
    });
    if (found.match) {
      openExistingModal(found.match);
      return;
    }
    toast('No matching active record — create would proceed against SharePoint SoT (not local DB).');
  });
  $('rccBulkStatus').addEventListener('click', () => {
    if (guardLockedAction()) return;
    toast('Bulk status change blocked while RED / requires review.');
  });
  $('rccSimFailVerify').addEventListener('click', () => {
    const opps = getOpportunities(state.feed);
    if (!opps.length) return;
    const id = opps[0].id || opps[0].opportunity_id;
    const result = saveAndVerify(
      state.feed,
      id,
      { status: opps[0].status, next_action: opps[0].next_action || 'Verified path' },
      { simulateReadbackFail: true },
    );
    state.feed = result.feed;
    toast(result.message, true);
    recompute({ verificationFailed: true });
  });
  $('rccSimSaveOk').addEventListener('click', () => {
    const opps = getOpportunities(state.feed);
    if (!opps.length) return;
    const id = opps[0].id || opps[0].opportunity_id;
    const result = saveAndVerify(state.feed, id, {
      status: opps[0].status,
      next_action: opps[0].next_action || 'Continue',
      last_action: 'Manual verify write',
    });
    state.feed = result.feed;
    toast(result.message, result.status !== 'SAVED_VERIFIED');
    recompute();
  });

  $('rccCards').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    onCardAction(btn.getAttribute('data-action'), btn.getAttribute('data-id'));
  });

  $('rccAuditSections').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-audit]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const kind = btn.getAttribute('data-audit');
    if (kind === 'dismiss') {
      const reason = prompt('Dismiss with reason (required):');
      if (!reason) return;
      state.dismissedAudits.set(id, { reason, at: new Date().toISOString() });
      state.repairLog.push({ at: new Date().toISOString(), id, action: 'dismiss', reason });
      renderAuditDrawer();
      toast('Dismissed with reason (auditable).');
      return;
    }
    if (kind === 'repair') {
      state.repairLog.push({ at: new Date().toISOString(), id, action: 'repair' });
      toast('Repair logged — preserve historical evidence.');
      return;
    }
    toast('Open Source (SoT / Outlook)');
  });

  $('rccMergeExisting').addEventListener('click', () => {
    toast('Merge/update existing record — no silent duplicate create.');
    closeModal();
  });
  $('rccCloseModal').addEventListener('click', closeModal);
}

export async function boot() {
  wireEvents();
  await loadFixture('green');
}

boot();

// Expose for QA / playwright-less browser console tests
window.RCC = {
  state,
  loadFixture,
  evaluateSyncHealth,
  findExistingOpportunity,
  saveAndVerify,
  reconcileSoftwareChecklist,
  parseListSoftwareBody,
  ACTION_LOCK_MESSAGE,
};
