/**
 * Sprint C1-PRO / NEWARK-P2 — Placement Workbench state engine (pure reducers).
 *
 * Two separate pipelines (never merge):
 * 1. Placement pipeline (unit.stage) — caseworker unit outreach milestones
 * 2. Application tracker (appRecords) — per client+property application status
 *
 * Mirror identical logic in index.html inline copy.
 */

export const C1PRO_STAGES = ['Reviewing', 'Contacted', 'Tour Set', 'Application Submitted', 'Application Approved', 'Placed', 'On Hold'];
export const C1PRO_READY_THRESHOLD = 80;

/** Client application tracker — 9 states per client+property pair. */
export const C1PRO_APP_STATUSES = [
  'Not Started',
  'Application Started',
  'Submitted',
  'Waiting for Response',
  'Documents Missing',
  'Follow-Up Needed',
  'Approved / Accepted',
  'Denied / Passed',
  'Placed'
];

const CONTACTED_STAGES = ['Contacted', 'Tour Set', 'Application Submitted', 'Application Approved', 'Placed'];
const TOUR_STAGES = ['Tour Set', 'Application Submitted', 'Application Approved', 'Placed'];
const APPLICATION_STAGES = ['Application Submitted', 'Application Approved', 'Placed'];

export function c1proAppRecordKey(clientId, unitId) {
  return String(clientId) + ':' + String(unitId);
}

export function c1proAppStatusIndex(status) {
  return C1PRO_APP_STATUSES.indexOf(status);
}

export function c1proDefaultAppRecord(clientId, unitId, atIso) {
  var at = atIso || new Date().toISOString();
  return {
    id: 'app-' + String(unitId).replace(/[^a-z0-9]/gi, '') + '-' + Date.now(),
    clientId: clientId,
    unitId: unitId,
    status: 'Not Started',
    notes: '',
    followUpDue: false,
    followUpNote: '',
    createdAt: at,
    updatedAt: at
  };
}

export function c1proGetAppRecord(state, clientId, unitId) {
  var key = c1proAppRecordKey(clientId, unitId);
  var rec = (state && state.appRecords && state.appRecords[key]) || null;
  if (rec) return Object.assign({}, rec);
  return c1proDefaultAppRecord(clientId, unitId);
}

export function c1proStageIndex(stage) {
  if (stage === 'On Hold') return -1;
  return C1PRO_STAGES.indexOf(stage);
}

export function c1proHasReachedStage(unitStage, milestone) {
  if (unitStage === 'On Hold' || milestone === 'On Hold') return false;
  var ui = c1proStageIndex(unitStage);
  var mi = c1proStageIndex(milestone);
  if (ui < 0 || mi < 0) return false;
  return ui >= mi;
}

export function c1proCountExactStage(units, stage) {
  return (units || []).filter(function(u) { return u.stage === stage; }).length;
}

export function c1proInitState(seed, persistedLog, persistedAppRecords, activeClientId) {
  var units = (seed && Array.isArray(seed.units) ? seed.units : []).map(function(u) {
    return Object.assign({}, u, { stage: 'Reviewing' });
  });
  var log = Array.isArray(persistedLog) ? persistedLog.slice() : [];
  var demoClient = seed && seed.demoClient ? seed.demoClient : null;
  return {
    units: units,
    log: log,
    activeClientId: activeClientId || (demoClient && demoClient.id) || 'client-marcus-demo',
    appRecords: persistedAppRecords && typeof persistedAppRecords === 'object'
      ? Object.assign({}, persistedAppRecords)
      : {}
  };
}

export function c1proSetStage(state, unitId, stage, atIso) {
  if (C1PRO_STAGES.indexOf(stage) < 0) return state;
  var log = state.log.slice();
  var at = atIso || new Date().toISOString();
  var units = state.units.map(function(u) {
    if (u.id !== unitId) return u;
    if (u.stage !== stage) {
      log.push({ unit: u.label, unitId: unitId, from: u.stage, to: stage, at: at });
    }
    return Object.assign({}, u, { stage: stage });
  });
  return Object.assign({}, state, { units: units, log: log });
}

export function c1proSetAppStatus(state, clientId, unitId, status, note) {
  if (C1PRO_APP_STATUSES.indexOf(status) < 0) return state;
  var at = new Date().toISOString();
  var key = c1proAppRecordKey(clientId, unitId);
  var prev = c1proGetAppRecord(state, clientId, unitId);
  var rec = Object.assign({}, prev, {
    status: status,
    updatedAt: at,
    followUpDue: status === 'Follow-Up Needed' ? true : prev.followUpDue
  });
  if (note !== undefined) rec.notes = String(note);
  if (!prev.createdAt) rec.createdAt = at;
  var appRecords = Object.assign({}, state.appRecords || {});
  appRecords[key] = rec;
  return Object.assign({}, state, { appRecords: appRecords });
}

export function c1proToggleFollowUp(state, clientId, unitId, followUpNote) {
  var at = new Date().toISOString();
  var key = c1proAppRecordKey(clientId, unitId);
  var prev = c1proGetAppRecord(state, clientId, unitId);
  var nextDue = !prev.followUpDue;
  var rec = Object.assign({}, prev, {
    followUpDue: nextDue,
    followUpNote: followUpNote !== undefined ? String(followUpNote) : (nextDue ? prev.followUpNote : ''),
    status: nextDue ? 'Follow-Up Needed' : prev.status,
    updatedAt: at
  });
  var appRecords = Object.assign({}, state.appRecords || {});
  appRecords[key] = rec;
  return Object.assign({}, state, { appRecords: appRecords });
}

export function c1proSetAppNotes(state, clientId, unitId, notes) {
  var key = c1proAppRecordKey(clientId, unitId);
  var prev = c1proGetAppRecord(state, clientId, unitId);
  var rec = Object.assign({}, prev, { notes: String(notes || ''), updatedAt: new Date().toISOString() });
  var appRecords = Object.assign({}, state.appRecords || {});
  appRecords[key] = rec;
  return Object.assign({}, state, { appRecords: appRecords });
}

function c1proClientAppRecordsList(state, clientId) {
  var units = (state && state.units) || [];
  return units.map(function(u) { return c1proGetAppRecord(state, clientId, u.id); });
}

export function c1proComputeClientMetrics(state, clientId) {
  var records = c1proClientAppRecordsList(state, clientId);
  var units = (state && state.units) || [];
  var m = {
    totalLeads: units.length,
    landlordsContacted: 0,
    appsStarted: 0,
    appsSubmitted: 0,
    waitingResponse: 0,
    documentsMissing: 0,
    followUpsDue: 0,
    approved: 0,
    denied: 0,
    placed: 0
  };
  records.forEach(function(rec) {
    var idx = c1proAppStatusIndex(rec.status);
    if (rec.status !== 'Not Started') m.landlordsContacted += 1;
    if (rec.status === 'Application Started') m.appsStarted += 1;
    if (rec.status === 'Submitted') m.appsSubmitted += 1;
    if (rec.status === 'Waiting for Response') m.waitingResponse += 1;
    if (rec.status === 'Documents Missing') m.documentsMissing += 1;
    if (rec.followUpDue || rec.status === 'Follow-Up Needed') m.followUpsDue += 1;
    if (rec.status === 'Approved / Accepted') m.approved += 1;
    if (rec.status === 'Denied / Passed') m.denied += 1;
    if (rec.status === 'Placed') m.placed += 1;
  });
  return m;
}

export function c1proComputeAgencyMetrics(state) {
  var appRecords = state && state.appRecords ? state.appRecords : {};
  var clientIds = {};
  Object.keys(appRecords).forEach(function(k) {
    var r = appRecords[k];
    if (r && r.clientId) clientIds[r.clientId] = true;
  });
  if (!Object.keys(clientIds).length && state && state.activeClientId) {
    clientIds[state.activeClientId] = true;
  }
  var ids = Object.keys(clientIds);
  var agg = {
    activeClients: ids.length || 1,
    totalLeads: 0,
    landlordsContacted: 0,
    appsStarted: 0,
    appsSubmitted: 0,
    waitingResponse: 0,
    documentsMissing: 0,
    followUpsDue: 0,
    approved: 0,
    denied: 0,
    placed: 0
  };
  ids.forEach(function(cid) {
    var cm = c1proComputeClientMetrics(state, cid);
    Object.keys(agg).forEach(function(k) {
      if (k !== 'activeClients') agg[k] += cm[k] || 0;
    });
  });
  if (!ids.length) {
    var single = c1proComputeClientMetrics(state, state.activeClientId || 'client-marcus-demo');
    Object.keys(agg).forEach(function(k) {
      if (k !== 'activeClients') agg[k] = single[k] || 0;
    });
  }
  return agg;
}

export function c1proUnitMatchesFilter(unit, filter) {
  if (!filter || filter === 'all' || filter === 'signal') return true;
  if (filter.indexOf('stage:') === 0) {
    var stage = filter.slice(6);
    if (stage === 'Reviewing') return unit.stage === 'Reviewing';
    if (stage === 'Placed') return unit.stage === 'Placed';
    if (stage === 'On Hold') return unit.stage === 'On Hold';
    return c1proHasReachedStage(unit.stage, stage);
  }
  return true;
}

export function c1proComputeMetrics(state) {
  var units = (state && state.units) || [];
  var avg = units.length
    ? Math.round(units.reduce(function(s, u) { return s + (u.readinessSignal || 0); }, 0) / units.length)
    : 0;
  var exact = {};
  C1PRO_STAGES.forEach(function(s) {
    exact[s] = c1proCountExactStage(units, s);
  });
  return {
    activeRecords: units.length,
    placementReady: units.filter(function(u) { return (u.readinessSignal || 0) >= C1PRO_READY_THRESHOLD; }).length,
    avgReadiness: avg,
    exactStage: exact,
    reachedContacted: units.filter(function(u) { return c1proHasReachedStage(u.stage, 'Contacted'); }).length,
    reachedTour: units.filter(function(u) { return c1proHasReachedStage(u.stage, 'Tour Set'); }).length,
    reachedApplication: units.filter(function(u) { return c1proHasReachedStage(u.stage, 'Application Submitted'); }).length,
    reachedAppApproved: units.filter(function(u) { return c1proHasReachedStage(u.stage, 'Application Approved'); }).length,
    reachedPlaced: units.filter(function(u) { return u.stage === 'Placed'; }).length,
    contactsLogged: units.filter(function(u) { return CONTACTED_STAGES.indexOf(u.stage) >= 0; }).length,
    toursSet: units.filter(function(u) { return TOUR_STAGES.indexOf(u.stage) >= 0; }).length,
    applications: units.filter(function(u) { return APPLICATION_STAGES.indexOf(u.stage) >= 0; }).length,
    placed: exact.Placed || 0,
    onHold: exact['On Hold'] || 0
  };
}
