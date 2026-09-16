import { HEALTH, ACTION_LOCK_MESSAGE, SCHEMA_VERSION } from './constants.js';
import { loadFeedFromUrl, getOpportunities } from './feed-loader.js';
import { evaluateSyncHealth, formatMetric } from './sync-health.js';
import { sortOpportunities, selectOwnerActionPanel } from './sorting.js';
import { findExistingOpportunity } from './dedupe.js';
import {
  reconcileSoftwareChecklist,
  parseListSoftwareBody,
} from './software-checklist.js';
import { saveAndVerify } from './save-verify.js';
import { cardViewModel } from './opportunity-card.js';
import {
  clearIncomingAttention,
  hasIncomingAttention,
  buildEmailThreadLink,
  leadIdOf,
} from './transmission.js';
import {
  auditMalformedPaths,
  CANONICAL_RCC_ROOT,
  formatResolvedPath,
  resolveRecordPath,
} from './paths.js';

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
  filter: 'all',
  dismissedAudits: new Map(),
  repairLog: [],
  openOppId: null,
  pathAudit: [],
  // Session-only "removed from active view" set. Never deletes SoT correspondence.
  removedIds: new Set(),
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
      <div class="rcc-lead-id">Lead ID ${esc(leadIdOf(o))}</div>
      <strong>${esc(o.company || o.vendor)}</strong>
      <div>Status: ${esc(o.status)} · Category: ${esc(o.owner_action_category || 'other')}</div>
      <div>Next: ${esc(o.next_action || '—')}</div>
    </div>`,
    )
    .join('');
}

function notRemoved(o) {
  return !state.removedIds.has(String(o.id || o.opportunity_id));
}

function visibleOpportunities() {
  return getOpportunities(state.feed).filter(notRemoved);
}

function filteredOpportunities() {
  const opps = sortOpportunities(visibleOpportunities());
  if (state.filter === 'incoming') {
    return opps.filter((o) => hasIncomingAttention(o));
  }
  return opps;
}

function renderFilterTabs() {
  const all = visibleOpportunities();
  const incomingCount = all.filter((o) => hasIncomingAttention(o)).length;
  $('rccIncomingCount').textContent = String(incomingCount);
  document.querySelectorAll('.rcc-tab').forEach((tab) => {
    const on = tab.getAttribute('data-filter') === state.filter;
    tab.classList.toggle('on', on);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $('rccCardsTitle').textContent =
    state.filter === 'incoming'
      ? `Incoming queue (${incomingCount})`
      : `Opportunities (${all.length})`;
}

function transmissionHtml(tx) {
  if (!tx) {
    return `<div class="rcc-tx muted">No transmission on record</div>`;
  }
  const dirClass =
    tx.direction === 'INCOMING'
      ? 'INCOMING'
      : tx.direction === 'OUTBOUND'
        ? 'OUTBOUND'
        : '';
  return `<div class="rcc-tx">
    <div class="rcc-tx-row">
      <span class="rcc-tx-dir ${dirClass}">${esc(tx.direction)}</span>
      <span class="rcc-tx-at">${esc(tx.at || '—')}</span>
    </div>
    <div class="rcc-tx-subject">${esc(tx.subject || '—')}</div>
    <div class="rcc-tx-sender">${esc(tx.sender || '—')}</div>
    ${tx.preview ? `<div class="rcc-tx-preview">${esc(tx.preview)}</div>` : ''}
    ${tx.eventId ? `<div class="rcc-tx-event">Event ${esc(tx.eventId)}</div>` : ''}
  </div>`;
}

function emailThreadControl(vm, id) {
  // Prefer a real navigable link so "Open Email Thread" never silently fails.
  if (vm.emailLink && vm.emailLink.href) {
    return `<a class="rcc-btn" href="${esc(vm.emailLink.href)}" target="_blank" rel="noopener noreferrer">Open Email Thread</a>`;
  }
  return `<button type="button" class="rcc-btn" data-action="open-source" data-id="${esc(id)}">Open Email Thread</button>`;
}

function renderCards() {
  const host = $('rccCards');
  const all = visibleOpportunities();
  const opps = filteredOpportunities();
  renderFilterTabs();
  if (!opps.length) {
    host.innerHTML =
      state.filter === 'incoming'
        ? '<p class="rcc-section-title">No incoming attention items.</p>'
        : '<p class="rcc-section-title">No opportunities in feed.</p>';
    return;
  }
  host.innerHTML = opps
    .map((opp) => {
      const vm = cardViewModel(opp, all);
      const id = opp.id || opp.opportunity_id;
      const badges = vm.badges
        .map((b) => `<span class="rcc-badge ${b.type}">${esc(b.label)}</span>`)
        .join('');
      return `<article class="rcc-card" data-opp-id="${esc(id)}">
        <div class="rcc-lead-id">Lead ID ${esc(vm.leadId)}</div>
        <h3>${esc(opp.company || opp.vendor || 'Opportunity')}</h3>
        <div class="rcc-badges">${badges}<span class="rcc-badge OK">Sync: ${esc(vm.sync)}</span></div>
        <dl class="rcc-card-meta">
          <div><dt>Tier</dt><dd>${esc(opp.tier)}</dd></div>
          <div><dt>Status</dt><dd>${esc(opp.status)}</dd></div>
          <div><dt>Last verified</dt><dd>${esc(opp.last_verified_at || '—')}</dd></div>
          <div><dt>Source</dt><dd>${esc(opp.source || opp.source_ref || '—')}</dd></div>
          <div><dt>Owner action required</dt><dd>${esc(vm.ownerYesNo)}</dd></div>
          <div><dt>Next action</dt><dd>${esc(opp.next_action || '—')}</dd></div>
        </dl>
        ${transmissionHtml(vm.transmission)}
        ${vm.timing ? `<div class="rcc-timing">${esc(vm.timing)}</div>` : ''}
        <div class="rcc-card-actions">
          <button type="button" class="rcc-btn primary" data-action="open-card" data-id="${esc(id)}">Open</button>
          ${
            vm.incoming
              ? `<button type="button" class="rcc-btn" data-action="clear-incoming" data-id="${esc(id)}">Clear Incoming</button>`
              : ''
          }
          <button type="button" class="rcc-btn" data-lockable="1" data-action="followup" data-id="${esc(id)}">Send Follow-up</button>
          <button type="button" class="rcc-btn" data-lockable="1" data-action="done" data-id="${esc(id)}">Mark Done</button>
          <button type="button" class="rcc-btn" data-lockable="1" data-action="pass" data-id="${esc(id)}">Close/Pass</button>
          ${emailThreadControl(vm, id)}
          <button type="button" class="rcc-btn" data-action="open-sp" data-id="${esc(id)}">Open SharePoint Record</button>
          <button type="button" class="rcc-btn" data-action="repair" data-id="${esc(id)}">Repair Record</button>
          <button type="button" class="rcc-btn danger" data-lockable="1" data-action="delete" data-id="${esc(id)}">Delete</button>
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
  const pathHits = state.pathAudit || [];
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
    'Malformed SharePoint Paths',
  ];
  host.innerHTML = sections
    .map((section) => {
      let items = rows.filter((r) => r.section === section);
      if (section === 'Malformed SharePoint Paths') {
        items = pathHits.map((h, i) => ({
          id: `path-${i}`,
          company: h.path,
          problem: 'Malformed Shared Documents/Shared Documents (or Documents/Documents) path',
          source: h.value,
          status: 'REJECT',
          recommended_fix: `Use canonical ${CANONICAL_RCC_ROOT}`,
        }));
      }
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

function findOpp(id) {
  return getOpportunities(state.feed).find(
    (o) => String(o.id || o.opportunity_id) === String(id),
  );
}

function patchOpp(id, patcher) {
  if (!state.feed) return null;
  const opps = getOpportunities(state.feed).map((o) => {
    if (String(o.id || o.opportunity_id) !== String(id)) return o;
    return patcher(o);
  });
  state.feed = { ...state.feed, opportunities: opps };
  return findOpp(id);
}

function openDetail(id) {
  const opp = findOpp(id);
  if (!opp) return;
  state.openOppId = id;
  const vm = cardViewModel(opp, getOpportunities(state.feed));
  $('rccDetailLeadId').textContent = `Lead ID ${vm.leadId}`;
  $('rccDetailTitle').textContent = opp.company || opp.vendor || 'Opportunity';
  $('rccDetailNotes').textContent = vm.notes || 'No notes yet.';
  const path = formatResolvedPath(resolveRecordPath(opp));
  $('rccDetailBody').innerHTML = `
    <dl class="rcc-card-meta">
      <div><dt>Status</dt><dd>${esc(opp.status)}</dd></div>
      <div><dt>Tier</dt><dd>${esc(opp.tier)}</dd></div>
      <div><dt>Last verified</dt><dd>${esc(opp.last_verified_at || '—')}</dd></div>
      <div><dt>SharePoint</dt><dd>${esc(path)}</dd></div>
      <div><dt>Next action</dt><dd>${esc(opp.next_action || '—')}</dd></div>
      <div><dt>Source</dt><dd>${esc(opp.source || opp.source_ref || '—')}</dd></div>
    </dl>
    <h3 class="rcc-detail-sub">Latest transmission</h3>
    ${transmissionHtml(vm.transmission)}
  `;
  const email = buildEmailThreadLink(opp);
  $('rccDetailActions').innerHTML = `
    ${
      vm.incoming
        ? `<button type="button" class="rcc-btn" data-action="clear-incoming" data-id="${esc(id)}">Clear Incoming</button>`
        : ''
    }
    ${
      email
        ? `<a class="rcc-btn primary" href="${esc(email.href)}" target="_blank" rel="noopener noreferrer">Open Email Thread</a>`
        : `<button type="button" class="rcc-btn" data-action="open-source" data-id="${esc(id)}">Open Email Thread</button>`
    }
    <button type="button" class="rcc-btn" data-action="open-sp" data-id="${esc(id)}">Open SharePoint Record</button>
    <button type="button" class="rcc-btn" data-lockable="1" data-action="followup" data-id="${esc(id)}">Send Follow-up</button>
    <button type="button" class="rcc-btn" data-lockable="1" data-action="done" data-id="${esc(id)}">Mark Done</button>
    <button type="button" class="rcc-btn" data-lockable="1" data-action="pass" data-id="${esc(id)}">Close/Pass</button>
    <button type="button" class="rcc-btn" data-action="repair" data-id="${esc(id)}">Repair Record</button>
    <button type="button" class="rcc-btn danger" data-lockable="1" data-action="delete" data-id="${esc(id)}">Delete</button>
  `;
  $('rccDetailBackdrop').classList.add('on');
  setLocked(!!state.health?.actionsLocked);
}

function closeDetail() {
  state.openOppId = null;
  $('rccDetailBackdrop').classList.remove('on');
}

function recompute(runtime = {}) {
  if (!state.feed) {
    state.health = evaluateSyncHealth(null, {
      feedReadable: false,
      feedError: state.loadError || 'Dashboard Feed cannot be read',
      runtime,
    });
    state.pathAudit = [];
  } else {
    state.health = evaluateSyncHealth(state.feed, { runtime });
    state.pathAudit = auditMalformedPaths(state.feed);
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
  if (state.openOppId) openDetail(state.openOppId);
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
  const m = $('rccModalBackdrop');
  $('rccExistingBody').innerHTML = `
    <p><strong>Lead ID:</strong> ${esc(leadIdOf(opp))}</p>
    <p><strong>Company:</strong> ${esc(opp.company || opp.vendor)}</p>
    <p><strong>Status:</strong> ${esc(opp.status)}</p>
    <p><strong>Last action:</strong> ${esc(opp.last_action || '—')}</p>
    <p><strong>Next action:</strong> ${esc(opp.next_action || '—')}</p>
    <p><strong>Most recent email:</strong> ${esc(opp.most_recent_email || '—')}</p>
  `;
  m.dataset.oppId = opp.id || opp.opportunity_id;
  m.classList.add('on');
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

function openEmailThread(opp) {
  const link = buildEmailThreadLink(opp);
  if (!link) {
    toast('No email/thread link available for this Lead ID', true);
    return;
  }
  const win = window.open(link.href, '_blank', 'noopener,noreferrer');
  // If a popup blocker prevented the window, surface the link instead of failing silently.
  if (!win) {
    toast(`Email thread: ${link.href}`);
  }
}

function onClearIncoming(id) {
  const before = findOpp(id);
  if (!before) return;
  const statusBefore = before.status;
  const notesBefore = before.notes;
  const txBefore = before.latest_transmission_at;
  const previewBefore = before.message_preview;
  const result = clearIncomingAttention(before);
  if (!result.ok) {
    toast(result.error || 'Clear Incoming failed', true);
    return;
  }
  patchOpp(id, () => result.opp);
  const after = findOpp(id);
  const ok =
    after &&
    after.incoming_attention === false &&
    after.status === statusBefore &&
    after.notes === notesBefore &&
    after.latest_transmission_at === txBefore &&
    after.message_preview === previewBefore;
  toast(
    ok
      ? `Incoming cleared for Lead ID ${leadIdOf(after)} — status unchanged`
      : 'Clear Incoming violated permanence rules',
    !ok,
  );
  recompute();
}

function onDelete(id) {
  const opp = findOpp(id);
  const label = opp ? opp.company || opp.vendor || id : id;
  const ok = window.confirm(
    `Delete "${label}" from the active dashboard view?\n\n` +
      'Correspondence and the SharePoint SoT record are preserved — this only ' +
      'removes it from the working queue and logs an auditable delete request.',
  );
  if (!ok) return;
  state.removedIds.add(String(id));
  state.repairLog.push({
    at: new Date().toISOString(),
    opportunityId: id,
    action: 'delete',
    note: 'Delete requested from UI — auditable; correspondence preserved',
  });
  if (state.openOppId === String(id) || state.openOppId === id) closeDetail();
  toast(`Deleted "${label}" from active view (auditable — correspondence preserved)`);
  recompute();
}

function onCardAction(action, id) {
  if (['followup', 'done', 'pass', 'bulk', 'delete'].includes(action) && guardLockedAction()) {
    return;
  }
  if (action === 'open-card') {
    openDetail(id);
    return;
  }
  if (action === 'delete') {
    onDelete(id);
    return;
  }
  if (action === 'clear-incoming') {
    onClearIncoming(id);
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
  if (action === 'open-source') {
    openEmailThread(findOpp(id));
    return;
  }
  if (action === 'open-sp') {
    const opp = findOpp(id);
    const resolved = resolveRecordPath(opp);
    const path = formatResolvedPath(resolved);
    if (resolved.malformedRejected) {
      toast(`Rejected malformed path — using ${path}`, true);
    } else {
      toast(`SharePoint SoT: ${path}`);
    }
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
  $('rccCloseDetail').addEventListener('click', closeDetail);
  $('rccDetailBackdrop').addEventListener('click', (e) => {
    if (e.target === $('rccDetailBackdrop')) closeDetail();
  });
  $('rccGateDismiss')?.addEventListener('click', () => {
    $('rccGate').hidden = true;
  });

  document.querySelectorAll('.rcc-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.filter = tab.getAttribute('data-filter') || 'all';
      renderCards();
    });
  });

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

  $('rccDetailActions').addEventListener('click', (e) => {
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
  // Obstructive banner stays hidden by default on mobile-first flow UI.
  await loadFixture('green');
}

boot();

// Expose for QA / browser console tests
window.RCC = {
  state,
  loadFixture,
  evaluateSyncHealth,
  findExistingOpportunity,
  saveAndVerify,
  reconcileSoftwareChecklist,
  parseListSoftwareBody,
  clearIncomingAttention,
  hasIncomingAttention,
  buildEmailThreadLink,
  leadIdOf,
  auditMalformedPaths,
  SCHEMA_VERSION,
  ACTION_LOCK_MESSAGE,
  CANONICAL_RCC_ROOT,
};
