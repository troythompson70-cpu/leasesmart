import { bannerFromFeedAge } from './banner-age.js';
import { HEALTH, ACTION_LOCK_MESSAGE, SCHEMA_VERSION } from './constants.js';
import { loadFeedFromUrl, loadLiveDashboardFeed, getOpportunities } from './feed-loader.js';
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
import { processDiscovery } from './discovery-pipeline.js';
import {
  acknowledgeActivity,
  classifyActivity,
  countUnreadActivity,
  isUnreadActivity,
  mergePersistedActivity,
  resetIncomingBuffer,
  stabilizeIncomingList,
} from './new-activity.js';
import { loadFeedCache, loadUiState, saveFeedCache, saveUiState } from './ui-persist.js';
import {
  acknowledgeNewReply,
  countNewReplies,
  listUnacknowledgedReplies,
  mergePersistedNewReplies,
  DISPOSITIONS,
} from './new-replies.js';
import { recentEmailOf, conversationSnapshotOf, sanitizeUiText } from './email-snapshot.js';
import {
  reconcileOrphanDiscoveries,
  comparePipelineToDashboard,
} from './orphan-reconcile.js';
import { enforceReportIntegrity, buildSixPmReportView } from './report-integrity.js';
import { runMailboxBackfill, assertBackfillIdempotent } from './mailbox-backfill.js';

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
  lastOrphanReport: null,
  demoMode: false,
  liveDisconnected: false,
};

function $(id) {
  return document.getElementById(id);
}

function persistView() {
  saveUiState({
    filter: state.filter,
    openOppId: state.openOppId,
    fixtureKey: state.fixtureKey,
  });
  if (state.feed) saveFeedCache(state.feed, state.fixtureKey);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function restoreView() {
  const ui = loadUiState();
  state.filter = ui.filter;
  state.openOppId = ui.openOppId;
  if (ui.fixtureKey) state.fixtureKey = ui.fixtureKey;
}

function assignOpportunities(feed, opps) {
  if (Array.isArray(feed.records) && !Array.isArray(feed.opportunities)) {
    return { ...feed, records: opps };
  }
  return { ...feed, opportunities: opps };
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

function paintConnectionBanner() {
  const el = $('rccConnectionBanner');
  if (!el) return;
  if (state.demoMode) {
    el.hidden = false;
    el.className = 'rcc-connection-banner on demo';
    el.textContent = 'DEMO DATA — NOT REAL';
    return;
  }
  if (state.liveDisconnected) {
    el.hidden = false;
    el.className = 'rcc-connection-banner on bad';
    const reason = state.loadError ? ` ${state.loadError}` : '';
    el.textContent = `LIVE DATA NOT CONNECTED.${reason}`;
    return;
  }
  el.hidden = true;
  el.className = 'rcc-connection-banner';
  el.textContent = '';
}

function renderHealth() {
  const h = state.health;
  const bar = $('rccHealthBar');
  if (!h) return;
  let bannerState = h.state;
  let title = `${h.state} — ${h.label}`;
  if (state.demoMode) {
    bannerState = 'YELLOW';
    title = 'DEMO DATA — NOT REAL';
  } else if (state.feed && !state.liveDisconnected) {
    const age = bannerFromFeedAge(state.feed);
    bannerState = age.state;
    title = age.title;
  }
  bar.className = `rcc-health ${bannerState}`;
  $('rccHealthTitle').textContent = title;
  paintConnectionBanner();
  $('mLastVerified').textContent = h.lastVerifiedAt || '—';
  $('mFeedUpdated').textContent = h.feedUpdatedAt || '—';
  $('mOrphanEmail').textContent = formatMetric(h.metrics.orphan_email_count);
  $('mOrphanRecord').textContent = formatMetric(
    h.metrics.orphan_discovery_count ?? h.metrics.orphan_record_count,
  );
  $('mDuplicate').textContent = formatMetric(h.metrics.duplicate_count);
  $('mInvalidRoute').textContent = formatMetric(h.metrics.invalid_route_count);
  $('mFailedWrite').textContent = formatMetric(h.metrics.failed_write_count);
  $('mStale').textContent = formatMetric(h.metrics.stale_record_count);
  const warn = $('rccMailboxWarn');
  if (warn) {
    const show = !h.mailboxCoverageVerified;
    warn.classList.toggle('on', show);
    warn.textContent =
      h.mailboxCoverageWarning || 'Full mailbox coverage is not verified.';
  }
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
      <div class="rcc-lead-id">Opportunity ID ${esc(leadIdOf(o))}</div>
      <strong>${esc(o.company || o.vendor)}</strong>
      <div>Status: ${esc(o.status)} · Category: ${esc(o.owner_action_category || 'other')}</div>
      <div>Next: ${esc(o.next_action || '—')}</div>
    </div>`,
    )
    .join('');
}

function filteredOpportunities() {
  const raw = getOpportunities(state.feed);
  if (state.filter === 'incoming') {
    return stabilizeIncomingList(raw);
  }
  const opps = sortOpportunities(raw);
  if (state.filter === 'new-activity') {
    return opps.filter((o) => isUnreadActivity(o));
  }
  if (state.filter === 'new-replies') {
    const ids = new Set(
      listUnacknowledgedReplies(state.feed).map((r) => String(r.opportunity_id || '')),
    );
    return opps.filter((o) => ids.has(String(o.opportunity_id || o.id)));
  }
  return opps;
}

function renderFilterTabs() {
  const all = getOpportunities(state.feed);
  const incomingCount = all.filter((o) => hasIncomingAttention(o)).length;
  const newActivityCount = countUnreadActivity(all);
  const newRepliesCount = countNewReplies(state.feed);
  $('rccIncomingCount').textContent = String(incomingCount);
  const nac = $('rccNewActivityCount');
  if (nac) {
    nac.textContent = String(newActivityCount);
    nac.classList.toggle('hot', newActivityCount > 0);
  }
  const nrc = $('rccNewRepliesCount');
  if (nrc) {
    nrc.textContent = String(newRepliesCount);
    nrc.classList.toggle('hot', newRepliesCount > 0);
  }
  document.querySelectorAll('.rcc-tab').forEach((tab) => {
    const on = tab.getAttribute('data-filter') === state.filter;
    tab.classList.toggle('on', on);
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (state.filter === 'incoming') {
    $('rccCardsTitle').textContent = `Incoming queue (${incomingCount})`;
  } else if (state.filter === 'new-activity') {
    $('rccCardsTitle').textContent = `New Activity / Unread (${newActivityCount})`;
  } else if (state.filter === 'new-replies') {
    $('rccCardsTitle').textContent = `NEW REPLIES (${newRepliesCount})`;
  } else {
    $('rccCardsTitle').textContent = `Opportunities (${all.length})`;
  }
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

function recentEmailHtml(recent) {
  if (!recent) {
    return `<section class="rcc-email-block"><h4>Recent Email</h4><div class="rcc-tx muted">No recent email</div></section>`;
  }
  const body = recent.preview || recent.body || recent.unavailable || '';
  return `<section class="rcc-email-block" aria-label="Recent Email">
    <h4>Recent Email</h4>
    <div class="rcc-tx">
      <div class="rcc-tx-row">
        <span class="rcc-tx-dir ${esc(recent.direction)}">${esc(recent.direction)}</span>
        <span class="rcc-tx-at">${esc(recent.at || '—')}</span>
      </div>
      <div class="rcc-tx-subject">${esc(recent.subject || '—')}</div>
      <div class="rcc-tx-sender">From: ${esc(recent.sender || '—')}</div>
      <div class="rcc-tx-sender">To: ${esc(recent.recipient || '—')}</div>
      <div class="rcc-tx-preview">${esc(body || '—')}</div>
    </div>
  </section>`;
}

function conversationSnapshotHtml(snap) {
  if (!snap || !snap.items?.length) {
    return `<section class="rcc-email-block"><h4>Conversation Snapshot</h4><div class="rcc-tx muted">Empty snapshot</div></section>`;
  }
  const rows = snap.items
    .map(
      (m) => `<div class="rcc-snap-item">
      <div class="rcc-tx-row">
        <span class="rcc-tx-dir ${esc(m.direction)}">${esc(m.direction)}</span>
        <span class="rcc-tx-at">${esc(m.at || '—')}</span>
      </div>
      <div class="rcc-tx-subject">${esc(m.subject || snap.thread || '—')}</div>
      <div class="rcc-tx-sender">${esc(m.sender || '—')} → ${esc(m.recipient || '—')}</div>
      <div class="rcc-tx-preview">${esc(m.preview || '—')}</div>
    </div>`,
    )
    .join('');
  return `<section class="rcc-email-block" aria-label="Conversation Snapshot">
    <h4>Conversation Snapshot</h4>
    ${rows}
  </section>`;
}

function renderNewReplyCards() {
  const replies = listUnacknowledgedReplies(state.feed);
  if (!replies.length) return '';
  return replies
    .map((r) => {
      const id = esc(r.source_message_id);
      const open = r.web_link
        ? `<a class="rcc-btn primary" href="${esc(r.web_link)}" target="_blank" rel="noopener noreferrer">Open Email</a>`
        : '';
      return `<article class="rcc-card unread rcc-new-reply-card" data-reply-id="${id}">
        <div class="rcc-lead-id">NEW REPLY · ${esc(r.lane || 'Revenue')}</div>
        <h3>${esc(r.company || 'Unknown company')}</h3>
        <div class="rcc-card-opp">${esc(r.subject || '—')}</div>
        <div class="rcc-badges"><span class="rcc-badge UNREAD">UNACKNOWLEDGED</span></div>
        <div class="rcc-tx">
          <div class="rcc-tx-row">
            <span class="rcc-tx-dir INCOMING">INCOMING</span>
            <span class="rcc-tx-at">${esc(r.received_at || '—')}</span>
          </div>
          <div class="rcc-tx-sender">From: ${esc(r.sender || r.sender_email || '—')}</div>
          <div class="rcc-tx-sender">To: ${esc(r.recipient || '—')}</div>
          <div class="rcc-tx-preview">${esc(r.body_preview || '—')}</div>
        </div>
        <div class="rcc-card-actions rcc-action-grid">
          ${open}
          <button type="button" class="rcc-btn" data-action="open-linked-opp" data-id="${esc(r.opportunity_id || '')}">Open Linked Opportunity</button>
          <button type="button" class="rcc-btn rcc-ack-btn" data-action="ack-reply" data-reply-id="${id}">Acknowledge + Disposition</button>
        </div>
        <div class="rcc-disposition-row" data-disposition-for="${id}" hidden>
          ${DISPOSITIONS.map(
            (d) =>
              `<button type="button" class="rcc-btn disposition ${d.toLowerCase()}" data-action="ack-reply-disposition" data-reply-id="${id}" data-disposition="${d}">${d}</button>`,
          ).join('')}
        </div>
      </article>`;
    })
    .join('');
}

function renderCards() {
  const host = $('rccCards');
  const all = getOpportunities(state.feed);
  renderFilterTabs();

  if (state.filter === 'new-replies') {
    const replyHtml = renderNewReplyCards();
    host.innerHTML =
      replyHtml ||
      '<p class="rcc-section-title">No unacknowledged NEW REPLIES.</p>';
    return;
  }

  const opps = filteredOpportunities();
  if (!opps.length) {
    host.innerHTML =
      state.filter === 'incoming'
        ? '<p class="rcc-section-title">No incoming attention items.</p>'
        : state.filter === 'new-activity'
          ? '<p class="rcc-section-title">No unacknowledged new activity.</p>'
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
      const unreadBadge = vm.unread
        ? '<span class="rcc-badge UNREAD">UNREAD</span>'
        : '';
      const email = vm.emailLink;
      const openEmailLabel = 'Open Email';
      return `<article class="rcc-card ${vm.unread ? 'unread' : ''}" data-opp-id="${esc(id)}">
        <div class="rcc-lead-id">Opportunity ID ${esc(vm.opportunityId || vm.leadId)}</div>
        <h3>${esc(vm.company || 'Opportunity')}</h3>
        <div class="rcc-card-opp">${esc(vm.opportunity || '—')}</div>
        <div class="rcc-badges">
          <span class="rcc-tier-lg">Tier ${esc(vm.tier)}</span>
          <span class="rcc-status-lg">${esc(vm.status)}</span>
          <span class="rcc-owner-lg ${vm.ownerYesNo === 'Yes' ? 'yes' : ''}">OWNER ACTION: ${esc(vm.ownerYesNo)}</span>
          ${unreadBadge}${badges}<span class="rcc-badge OK">Sync: ${esc(vm.sync)}</span>
        </div>
        <dl class="rcc-card-meta">
          <div><dt>Owner</dt><dd>${esc(vm.owner)}</dd></div>
          <div><dt>Source</dt><dd>${esc(vm.source || '—')}</dd></div>
          <div><dt>Domain</dt><dd>${esc(vm.domain || '—')}</dd></div>
          <div><dt>Last activity</dt><dd>${esc(vm.lastActivity || '—')}</dd></div>
          <div><dt>Next action</dt><dd>${esc(vm.nextAction || '—')}</dd></div>
          <div><dt>Follow-up</dt><dd>${esc(vm.followUp || '—')}</dd></div>
          <div><dt>Ack</dt><dd>${esc(vm.acknowledgement)}</dd></div>
          <div><dt>Classification</dt><dd>${esc(vm.classification)}</dd></div>
        </dl>
        ${recentEmailHtml(vm.recentEmail)}
        ${conversationSnapshotHtml(vm.conversationSnapshot)}
        ${vm.timing ? `<div class="rcc-timing">${esc(vm.timing)}</div>` : ''}
        <div class="rcc-card-actions rcc-action-grid">
          <button type="button" class="rcc-btn primary" data-action="open-card" data-id="${esc(id)}">Open</button>
          <button type="button" class="rcc-btn" data-action="contact" data-id="${esc(id)}">Contact</button>
          <button type="button" class="rcc-btn" data-action="ready" data-id="${esc(id)}">Ready</button>
          <button type="button" class="rcc-btn" data-action="tier" data-id="${esc(id)}">Tier</button>
          ${
            vm.incoming
              ? `<button type="button" class="rcc-btn" data-action="clear-incoming" data-id="${esc(id)}">Clear Incoming</button>`
              : ''
          }
          ${
            email
              ? `<a class="rcc-btn" href="${esc(email.href)}" target="_blank" rel="noopener noreferrer">${openEmailLabel}</a>`
              : `<button type="button" class="rcc-btn" data-action="open-source" data-id="${esc(id)}">${openEmailLabel}</button>`
          }
          ${
            vm.unread
              ? `<button type="button" class="rcc-btn rcc-ack-btn" data-action="acknowledge" data-id="${esc(id)}">Acknowledge Activity</button>`
              : ''
          }
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
    'Orphan Discoveries',
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
  state.feed = assignOpportunities(state.feed, opps);
  return findOpp(id);
}

function openDetail(id) {
  const opp = findOpp(id);
  if (!opp) return;
  state.openOppId = id;
  persistView();
  const vm = cardViewModel(opp, getOpportunities(state.feed));
  $('rccDetailLeadId').textContent = `Opportunity ID ${vm.opportunityId || vm.leadId}`;
  $('rccDetailTitle').textContent = opp.company || opp.vendor || 'Opportunity';
  $('rccDetailNotes').textContent = vm.notes || 'No notes yet.';
  const path = formatResolvedPath(resolveRecordPath(opp));
  $('rccDetailBody').innerHTML = `
    <dl class="rcc-card-meta">
      <div><dt>Status</dt><dd>${esc(opp.status)}</dd></div>
      <div><dt>Tier</dt><dd>${esc(opp.tier)}</dd></div>
      <div><dt>Ack</dt><dd>${esc(vm.acknowledgement)}</dd></div>
      <div><dt>Classification</dt><dd>${esc(vm.classification)}</dd></div>
      <div><dt>Domain</dt><dd>${esc(vm.domain || '—')}</dd></div>
      <div><dt>SharePoint</dt><dd>${esc(path)}</dd></div>
      <div><dt>Next action</dt><dd>${esc(sanitizeUiText(opp.next_action) || '—')}</dd></div>
      <div><dt>Source</dt><dd>${esc(sanitizeUiText(opp.source || opp.source_ref) || '—')}</dd></div>
    </dl>
    ${recentEmailHtml(vm.recentEmail || recentEmailOf(opp))}
    ${conversationSnapshotHtml(vm.conversationSnapshot || conversationSnapshotOf(opp))}
  `;

  // NAVIGATION LOGIC: Professional Prev/Next
  const allOpps = getOpportunities(state.feed);
  const currentIndex = allOpps.findIndex(o => (o.id || o.opportunity_id) === id);
  const prevId = currentIndex > 0 ? allOpps[currentIndex - 1].id || allOpps[currentIndex - 1].opportunity_id : null;
  const nextId = currentIndex < allOpps.length - 1 ? allOpps[currentIndex + 1].id || allOpps[currentIndex + 1].opportunity_id : null;

  const navHtml = `
    <div class="rcc-detail-nav" style="display:flex; justify-content:space-between; margin-bottom:12px; gap:10px;">
      <button type="button" class="rcc-btn" ${!prevId ? 'disabled' : ''} data-nav="prev" data-id="${prevId}">← Previous</button>
      <button type="button" class="rcc-btn" ${!nextId ? 'disabled' : ''} data-nav="next" data-id="${nextId}">Next →</button>
    </div>
  `;

  const email = buildEmailThreadLink(opp);
  $('rccDetailActions').innerHTML = `
    ${navHtml}
    <div class="rcc-action-grid">
    ${
      vm.unread
        ? `<button type="button" class="rcc-btn rcc-ack-btn" data-action="acknowledge" data-id="${esc(id)}">Acknowledge Activity</button>`
        : ''
    }
    <button type="button" class="rcc-btn" data-action="classify-valid" data-id="${esc(id)}">Classify VALID</button>
    <button type="button" class="rcc-btn" data-action="classify-invalid" data-id="${esc(id)}">Classify INVALID</button>
    <button type="button" class="rcc-btn" data-action="classify-unsure" data-id="${esc(id)}">Classify UNSURE</button>
    <button type="button" class="rcc-btn" data-action="contact" data-id="${esc(id)}">Contact</button>
    <button type="button" class="rcc-btn" data-action="ready" data-id="${esc(id)}">Ready</button>
    <button type="button" class="rcc-btn" data-action="tier" data-id="${esc(id)}">Tier</button>
    ${
      vm.incoming
        ? `<button type="button" class="rcc-btn" data-action="clear-incoming" data-id="${esc(id)}">Clear Incoming</button>`
        : ''
    }
    ${
      email
        ? `<a class="rcc-btn primary" href="${esc(email.href)}" target="_blank" rel="noopener noreferrer">Open Email</a>`
        : `<button type="button" class="rcc-btn" data-action="open-source" data-id="${esc(id)}">Open Email</button>`
    }
    <button type="button" class="rcc-btn" data-action="open-sp" data-id="${esc(id)}">Open SharePoint Record</button>
    <button type="button" class="rcc-btn" data-lockable="1" data-action="followup" data-id="${esc(id)}">Send Follow-up</button>
    <button type="button" class="rcc-btn" data-lockable="1" data-action="done" data-id="${esc(id)}">Mark Done</button>
    <button type="button" class="rcc-btn" data-lockable="1" data-action="pass" data-id="${esc(id)}">Close/Pass</button>
    <button type="button" class="rcc-btn" data-action="repair" data-id="${esc(id)}">Repair Record</button>
    </div>
  `;
  $('rccDetailBackdrop').classList.add('on');
  setLocked(!!state.health?.actionsLocked);
}

function closeDetail() {
  state.openOppId = null;
  persistView();
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
      finalSyncState: 'OUT OF SYNC — BLOCKERS REMAIN',
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
  persistView();
}

function applyLoadedFeed(feed, fixtureKey, loadError) {
  state.fixtureKey = fixtureKey;
  state.feed = feed ? mergePersistedNewReplies(mergePersistedActivity(feed)) : null;
  state.loadError = loadError;
  recompute();
}

function isDemoRequest() {
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

function dashboardFeedUrl() {
  if (typeof window !== 'undefined' && window.RCC_DASHBOARD_FEED_URL) {
    return window.RCC_DASHBOARD_FEED_URL;
  }
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return `${window.location.origin}/api/dashboard-feed`;
  }
  return 'http://127.0.0.1:5173/api/dashboard-feed';
}

function showLiveDisconnected(reason) {
  state.demoMode = false;
  state.liveDisconnected = true;
  state.fixtureKey = 'live-sharepoint';
  state.feed = null;
  state.loadError = reason || 'Dashboard Feed cannot be read';
  recompute();
}

async function loadLiveOrFixture(key) {
  if (isDemoRequest()) {
    state.demoMode = true;
    state.liveDisconnected = false;
    await loadFixture(FIXTURES[key] ? key : 'green');
    return;
  }
  state.demoMode = false;
  const liveP = loadLiveDashboardFeed(dashboardFeedUrl());
  const first = await Promise.race([
    liveP.then((live) => ({ kind: 'live', live })),
    delay(2500).then(() => ({ kind: 'timeout' })),
  ]);

  if (first.kind === 'live' && first.live.ok) {
    state.liveDisconnected = false;
    applyLoadedFeed(first.live.feed, 'live-sharepoint', null);
    return;
  }

  const reason =
    first.kind === 'live'
      ? first.live.error
      : 'Dashboard Feed cannot be read (timed out after 2.5s).';
  showLiveDisconnected(reason);
  liveP.then((live) => {
    if (live.ok) {
      state.liveDisconnected = false;
      applyLoadedFeed(live.feed, 'live-sharepoint', null);
    }
  });
}

async function loadFixture(key) {
  resetIncomingBuffer();
  state.fixtureKey = key;
  const url = FIXTURES[key];
  const loaded = await loadFeedFromUrl(url);
  if (!loaded.ok) {
    state.feed = null;
    state.loadError = loaded.error;
  } else {
    state.feed = mergePersistedNewReplies(mergePersistedActivity(loaded.feed));
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
    <p><strong>Opportunity ID:</strong> ${esc(leadIdOf(opp))}</p>
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
    toast('No email/thread link available for this Opportunity ID', true);
    return;
  }
  window.open(link.href, '_blank', 'noopener,noreferrer');
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
      ? `Incoming cleared for Opportunity ID ${leadIdOf(after)} — status unchanged`
      : 'Clear Incoming violated permanence rules',
    !ok,
  );
  recompute();
}

function onAcknowledge(id) {
  const before = findOpp(id);
  if (!before) return;
  const statusBefore = before.status;
  const classBefore = before.classification || 'UNSURE';
  const result = acknowledgeActivity(before);
  if (!result.ok) {
    toast(result.error || 'Acknowledge failed', true);
    return;
  }
  patchOpp(id, () => result.opp);
  const after = findOpp(id);
  const ok =
    after &&
    after.acknowledgement_state === 'ACKNOWLEDGED' &&
    after.status === statusBefore &&
    (after.classification || 'UNSURE') === classBefore;
  toast(
    ok
      ? `Acknowledged ${leadIdOf(after)} — status/classification unchanged`
      : 'Acknowledge violated permanence rules',
    !ok,
  );
  recompute();
}

function onAckReplyPrompt(replyId) {
  const row = document.querySelector(`[data-disposition-for="${CSS.escape(replyId)}"]`);
  if (row) row.hidden = !row.hidden;
}

function onAckReplyDisposition(replyId, disposition) {
  const result = acknowledgeNewReply(state.feed, replyId, disposition, 'Troy');
  if (!result.ok) {
    toast(result.error || 'Acknowledgement rejected', true);
    return;
  }
  state.feed = result.feed;
  toast(`NEW REPLY acknowledged · ${disposition}`);
  recompute();
}

function onClassify(id, classification) {
  const before = findOpp(id);
  if (!before) return;
  const result = classifyActivity(before, classification);
  if (!result.ok) {
    toast(result.error || 'Classify failed', true);
    return;
  }
  patchOpp(id, () => result.opp);
  toast(`Classification set to ${classification} — status unchanged`);
  recompute();
}

function runOrphanReconcileNow() {
  if (!state.feed) return;
  const report = reconcileOrphanDiscoveries(state.feed);
  state.feed = report.feed;
  state.lastOrphanReport = report;
  toast(
    `Orphans found ${report.ORPHAN_DISCOVERIES_FOUND} · repaired ${report.ORPHAN_DISCOVERIES_REPAIRED} · unresolved ${report.UNRESOLVED_ORPHANS}`,
    report.UNRESOLVED_ORPHANS > 0,
  );
  recompute();
  return report;
}

function onCardAction(action, id, el = null) {
  if (['followup', 'done', 'pass', 'bulk'].includes(action) && guardLockedAction()) {
    return;
  }
  if (action === 'ack-reply') {
    onAckReplyPrompt(el?.getAttribute('data-reply-id') || id);
    return;
  }
  if (action === 'ack-reply-disposition') {
    onAckReplyDisposition(
      el?.getAttribute('data-reply-id') || id,
      el?.getAttribute('data-disposition'),
    );
    return;
  }
  if (action === 'open-linked-opp') {
    if (id) openDetail(id);
    return;
  }
  if (action === 'contact' || action === 'ready' || action === 'tier') {
    toast(`${action} control — use disposition/next action to update status`);
    return;
  }
  if (action === 'open-card') {
    openDetail(id);
    return;
  }
  if (action === 'acknowledge') {
    onAcknowledge(id);
    return;
  }
  if (action === 'classify-valid') {
    onClassify(id, 'VALID');
    return;
  }
  if (action === 'classify-invalid') {
    onClassify(id, 'INVALID');
    return;
  }
  if (action === 'classify-unsure') {
    onClassify(id, 'UNSURE');
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
    if (!isDemoRequest()) {
      e.target.value = 'live-sharepoint';
      loadLiveOrFixture('green');
      return;
    }
    state.demoMode = true;
    loadFixture(e.target.value);
  });
  $('rccOpenAudit').addEventListener('click', () => openDrawer(true));
  $('rccCloseAudit').addEventListener('click', () => openDrawer(false));
  $('rccDrawerBackdrop').addEventListener('click', () => openDrawer(false));
  $('rccRefresh').addEventListener('click', () => {
    persistView();
    if (state.feed) {
      state.feed = mergePersistedNewReplies(mergePersistedActivity(state.feed));
      runOrphanReconcileNow();
    } else if (state.fixtureKey === 'live-sharepoint') {
      loadLiveOrFixture('green');
    } else {
      loadFixture(state.fixtureKey);
    }
  });
  $('rccRunOrphanReconcile')?.addEventListener('click', () => runOrphanReconcileNow());
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
      persistView();
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
    const result = processDiscovery(state.feed, {
      company,
      subject,
      thread_subject: subject,
      thread_id: threadId,
      source: 'MANUAL_ENTRY',
    });
    state.feed = result.feed;
    toast(
      result.ok
        ? `SAVED + VERIFIED — ${result.opportunity?.opportunity_id}`
        : result.error || 'Discovery write blocked',
      !result.ok,
    );
    recompute(result.ok ? {} : { unverifiedFailedWrite: true });
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
    onCardAction(btn.getAttribute('data-action'), btn.getAttribute('data-id'), btn);
  });

  $('rccDetailActions').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    onCardAction(btn.getAttribute('data-action'), btn.getAttribute('data-id'), btn);
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
      runOrphanReconcileNow();
      toast('Repair + orphan reconcile executed.');
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
  restoreView();
  const fixtureSelect = $('rccFixtureSelect');
  if (isDemoRequest()) {
    state.demoMode = true;
    if (fixtureSelect && state.fixtureKey && FIXTURES[state.fixtureKey]) {
      fixtureSelect.value = state.fixtureKey;
    }
    await loadFixture(FIXTURES[state.fixtureKey] ? state.fixtureKey : 'green');
  } else {
    if (fixtureSelect) fixtureSelect.value = 'live-sharepoint';
    await loadLiveOrFixture('green');
  }
  setInterval(() => {
    if (state.feed && !state.demoMode) renderHealth();
  }, 60_000);
}

boot();

// Expose for QA / browser console tests
window.RCC = {
  state,
  loadFixture,
  loadLiveOrFixture,
  loadLiveDashboardFeed,
  evaluateSyncHealth,
  bannerFromFeedAge,
  findExistingOpportunity,
  saveAndVerify,
  processDiscovery,
  reconcileOrphanDiscoveries,
  comparePipelineToDashboard,
  enforceReportIntegrity,
  buildSixPmReportView,
  runMailboxBackfill,
  assertBackfillIdempotent,
  acknowledgeActivity,
  classifyActivity,
  countUnreadActivity,
  isUnreadActivity,
  mergePersistedActivity,
  stabilizeIncomingList,
  sortOpportunities,
  loadUiState,
  saveUiState,
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
