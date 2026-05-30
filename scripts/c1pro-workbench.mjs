/**
 * Sprint C1-PRO / NEWARK-P2 — Placement Workbench state engine (pure reducers).
 *
 * This is the Node-importable mirror of the in-memory state engine. The browser
 * runs an identical inline copy inside index.html (LeaseSmart is a single-file,
 * script-tag app, so a bare .mjs cannot be loaded via a normal <script> tag).
 * Keeping the canonical logic here lets the regression suite unit-test the
 * reducers in isolation. If you change a reducer, change BOTH copies.
 *
 * Pure: every reducer returns a NEW state object and never mutates its input.
 * No fetch, no storage, no Supabase, no PII. Sandbox demo state only.
 */

export const C1PRO_STAGES = ['Reviewing', 'Contacted', 'Tour Set', 'Application Submitted', 'Application Approved', 'Placed', 'On Hold'];
export const C1PRO_READY_THRESHOLD = 80;

// Stage sets that drive the live counters. A stage counts toward an earlier
// milestone once it has reached or passed it (e.g. "Placed" implies contact,
// tour, and application were all reached).
const CONTACTED_STAGES = ['Contacted', 'Tour Set', 'Application Submitted', 'Application Approved', 'Placed'];
const TOUR_STAGES = ['Tour Set', 'Application Submitted', 'Application Approved', 'Placed'];
const APPLICATION_STAGES = ['Application Submitted', 'Application Approved', 'Placed'];

export function c1proInitState(seed) {
  const units = (seed && Array.isArray(seed.units) ? seed.units : []).map(function(u) {
    return Object.assign({}, u, { stage: 'Reviewing' });
  });
  return { units: units, log: [] };
}

export function c1proSetStage(state, unitId, stage) {
  if (C1PRO_STAGES.indexOf(stage) < 0) return state;
  const log = state.log.slice();
  const units = state.units.map(function(u) {
    if (u.id !== unitId) return u;
    if (u.stage !== stage) {
      log.push({ unit: u.label, from: u.stage, to: stage });
    }
    return Object.assign({}, u, { stage: stage });
  });
  return { units: units, log: log };
}

export function c1proComputeMetrics(state) {
  const units = (state && state.units) || [];
  const avg = units.length
    ? Math.round(units.reduce(function(s, u) { return s + (u.readinessSignal || 0); }, 0) / units.length)
    : 0;
  return {
    activeRecords: units.length,
    placementReady: units.filter(function(u) { return (u.readinessSignal || 0) >= C1PRO_READY_THRESHOLD; }).length,
    avgReadiness: avg,
    contactsLogged: units.filter(function(u) { return CONTACTED_STAGES.indexOf(u.stage) >= 0; }).length,
    toursSet: units.filter(function(u) { return TOUR_STAGES.indexOf(u.stage) >= 0; }).length,
    applications: units.filter(function(u) { return APPLICATION_STAGES.indexOf(u.stage) >= 0; }).length,
    placed: units.filter(function(u) { return u.stage === 'Placed'; }).length
  };
}
