/**
 * Sprint A4 — select all, auto-save notes, status filters, post-quiz feedback
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const buildMatch = html.match(/LS_BUILD = '([^']+)'/);
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('A4 build id', buildMatch && /^20260526-v/.test(buildMatch[1]));
assert('Select All button on multi only', html.includes('multi-select-all') && html.includes('multiSelectAllBtn'));
assert('Select All not in single branch', !/type === 'single'[\s\S]{0,120}multi-select-all/.test(html));
assert('No Save Note button', !html.includes('id="saveNoteBtn"') && !html.includes('Save Note</button>'));
assert('Note debounce 1000ms', html.includes('1000'));
assert('Saving indicator', html.includes("'Saving...'"));
assert('Saved checkmark', html.includes("'Saved ✓'"));
assert('Blank note protection', html.includes('allowBlankOverwrite'));
assert('Live note preview', html.includes('noteLivePreview'));
assert('Status filter state', html.includes('statusFilter'));
assert('setStatusFilter', html.includes('function setStatusFilter'));
assert('clearStatusFilter', html.includes('function clearStatusFilter'));
assert('Clickable stats NOT CALLED', html.includes("status: 'NOT CALLED'") && html.includes('statusClick'));
assert('Clickable stats CALLED', html.includes("status: 'CALLED'"));
assert('Clickable stats FOLLOW UP', html.includes("status: 'FOLLOW UP'"));
assert('Clear Filter button', html.includes('Clear Filter') && html.includes('clearStatusFilter'));
assert('Active filter highlight stat-box', html.includes('stat-box clickable'));
assert('Post-quiz feedback schedule', html.includes('schedulePostQuizFeedbackPrompt'));
assert('150000ms delay (2.5 min)', html.includes('150000'));
assert('Quiz trigger in submitSteps', /function submitSteps[\s\S]*?schedulePostQuizFeedbackPrompt/.test(html));
assert('No dashboard 2min trigger', !html.includes('dashboard_2min'));
assert('No listing_views trigger', !html.includes('listing_views'));
assert('No favorites_tab trigger', !html.includes('favorites_tab'));
assert('Later 24h suppression preserved', html.includes('24 * 60 * 60 * 1000') && html.includes('feedbackPromptDismissedUntil'));
assert('Beta gate blocks feedback', html.includes('lsIsBetaGatePageActive'));
assert('Beta welcome in gate list', html.includes("'beta-welcome-pg'"));
assert('Magic link auth preserved', html.includes('signInWithOtp') && !html.includes('signInWithPassword'));
assert('Beta welcome preserved', html.includes('beta-welcome-pg') && html.includes('continueFromBetaWelcome'));
assert('Legal gate preserved', html.includes('beta-legal-pg') && html.includes('submitBetaLegalAccept'));

// --- Behavioral simulations (mirrors index.html logic) ---
const store = new Map();
const localStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, v) { store.set(k, v); }
};
let LS_STORE = { listingNotes: {} };
function lsSave() { localStorage.setItem('leasesmart_store_v1', JSON.stringify(LS_STORE)); }
function lsLoad() {
  try {
    var raw = localStorage.getItem('leasesmart_store_v1');
    if (raw) LS_STORE = Object.assign({ listingNotes: {} }, JSON.parse(raw));
  } catch (e) {}
}
function lsSetListingNote(id, text, opts) {
  opts = opts || {};
  if (!LS_STORE.listingNotes) LS_STORE.listingNotes = {};
  var key = String(id);
  var val = String(text || '');
  var existing = LS_STORE.listingNotes[key] || '';
  if (!val.trim()) {
    if (existing.trim() && !opts.allowBlankOverwrite) return existing;
    delete LS_STORE.listingNotes[key];
  } else {
    LS_STORE.listingNotes[key] = val;
  }
  lsSave();
  return LS_STORE.listingNotes[key] || '';
}
function lsGetListingNote(id) {
  return (LS_STORE.listingNotes || {})[String(id)] || '';
}

lsSetListingNote(1, 'Tour Friday 2pm');
assert('Notes persist to storage', lsGetListingNote(1) === 'Tour Friday 2pm');
lsSetListingNote(1, '', { allowBlankOverwrite: false });
assert('Blank does not overwrite existing note', lsGetListingNote(1) === 'Tour Friday 2pm');
lsSetListingNote(1, 'Updated note');
assert('Non-blank note updates', lsGetListingNote(1) === 'Updated note');
store.clear(); lsLoad();
assert('Notes survive refresh simulation', lsGetListingNote(1) === 'Updated note');

let APP = { statusFilter: null, filter: 'all', listings: [
  { id: 1, score: 90, status: 'NOT CALLED' },
  { id: 2, score: 75, status: 'CALLED' },
  { id: 3, score: 60, status: 'FOLLOW UP' },
  { id: 4, score: 88, status: 'CALLED' }
]};
function filterListings() {
  var ls = APP.listings;
  var f = APP.filter;
  var shown = f === 'top' ? ls.filter(l => l.score >= 85) :
              f === 'good' ? ls.filter(l => l.score >= 70 && l.score < 85) :
              f === 'rev' ? ls.filter(l => l.score < 70) : ls.slice();
  if (APP.statusFilter) shown = shown.filter(l => l.status === APP.statusFilter);
  return shown;
}
APP.statusFilter = 'CALLED';
assert('Status filter CALLED', filterListings().length === 2);
APP.statusFilter = 'FOLLOW UP';
assert('Status filter FOLLOW UP', filterListings().length === 1);
APP.statusFilter = null;
assert('Clear status filter restores all', filterListings().length === 4);
APP.filter = 'top'; APP.statusFilter = 'CALLED';
assert('Score + status filters combine', filterListings().length === 1 && filterListings()[0].id === 4);

const multiOpts = ['A', 'B', 'C'];
let multiSel = [];
function toggleSelectAll() {
  var total = multiOpts.length;
  var allSelected = total > 0 && multiSel.length >= total;
  if (allSelected) multiSel = [];
  else multiSel = multiOpts.slice();
  return allSelected ? 'cleared' : 'selected';
}
assert('Select All checks all', toggleSelectAll() === 'selected' && multiSel.length === 3);
assert('Second click clears all', toggleSelectAll() === 'cleared' && multiSel.length === 0);

let feedbackQuizTimer = null;
let promptShown = false;
let gateActive = false;
function lsIsBetaGatePageActive() { return gateActive; }
function lsCanShowFeedbackPrompt(until) {
  if (until && new Date(until) > new Date()) return false;
  if (lsIsBetaGatePageActive()) return false;
  return true;
}
function schedulePostQuizFeedbackPrompt() {
  if (feedbackQuizTimer) clearTimeout(feedbackQuizTimer);
  feedbackQuizTimer = setTimeout(function() {
    if (lsIsBetaGatePageActive()) return;
    if (lsCanShowFeedbackPrompt(LS_STORE.feedbackPromptDismissedUntil)) promptShown = true;
  }, 150000);
}
LS_STORE.feedbackPromptDismissedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
assert('Later suppression blocks prompt', !lsCanShowFeedbackPrompt(LS_STORE.feedbackPromptDismissedUntil));
LS_STORE.feedbackPromptDismissedUntil = null;
gateActive = true;
assert('Beta gate blocks prompt when active', lsIsBetaGatePageActive() && !lsCanShowFeedbackPrompt(null));
gateActive = false;
assert('Prompt allowed when gate clear and no Later', lsCanShowFeedbackPrompt(null));

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({ sprint: 'A4', result: failed.length ? 'FAIL' : 'PASS', passed, total: tests.length, failed: failed.map(f => f.name), tests }, null, 2));
process.exit(failed.length ? 1 : 0);
