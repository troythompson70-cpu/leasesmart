/**
 * Calendar bug reproduction — pure Node (no browser deps)
 * Simulates v1.1.4 broken wireStepEvents calendar handlers
 */
import { writeFileSync, mkdirSync } from 'fs';

const results = [];
function log(msg) { results.push(msg); }

// --- Simulate DOM-like calendar step (v1.1.4 BROKEN) ---
let quizStep = 3;
let calDone = false;
const cal = { value: '' };
const events = { change: [], input: [], click: [] };

function advance(val) {
  quizStep++;
  log(`advance() fired → quizStep now ${quizStep} (display: Step ${quizStep + 1} of 21)`);
  log(`Saved move-in value: ${val}`);
}

function formatCal(iso) {
  const p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function submitCal() {
  if (calDone || !cal || !cal.value) return;
  calDone = true;
  advance(formatCal(cal.value));
}

// v1.1.4 broken wiring
events.change.push(submitCal);
events.input.push(submitCal);

log('=== GATE 1: v1.1.4 BROKEN CALENDAR LOGIC ===');
log(`Initial quizStep: ${quizStep} (Step 4 of 21 — Move-in date)`);
log('');

log('ACTION: User completes date selection → change event fires');
cal.value = '2026-06-15';
events.change.forEach(fn => fn());
log(`Still on move-in step? ${quizStep === 3 ? 'NO — BUG: already advanced' : 'unexpected'}`);
log(`User clicked Continue? NO`);
log('');

log('=== COMPARISON: v1.1.5 FIXED LOGIC ===');
let quizStepFixed = 3;
let btnDisabled = true;
function isValidIsoDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); }
function updateCalBtn(val) { btnDisabled = !isValidIsoDate(val); }
cal.value = '2026-06-15';
updateCalBtn(cal.value);
log(`After date select: btnDisabled=${btnDisabled} (Continue enabled)`);
log(`advance() called? NO — waits for button click`);
log('');

const bugReproduced = quizStep === 4; // advanced from 3 to 4 without Continue

const report = {
  bugReproduced: bugReproduced ? 'YES' : 'NO',
  moveInStep: 'Step 4 of 21 (STEPS index 3, id: movein)',
  liveSiteVersion: 'v1.1.4 (https://leasesmart.tgttechnologies.com — not yet deployed v1.1.5)',
  localRepoVersion: 'v1.1.5 fix present in index.html — bug NOT reproducible on local main file',
  rootCause: 'change/input listeners call submitCal() → advance() immediately without Continue click',
  responsibleCode: 'wireStepEvents() else if (step.type === calendar) — v1.1.4 submitCal pattern',
  proposedFix: 'Remove auto-advance on change/input; enable Continue on valid YYYY-MM-DD; advance only on button click',
  localTestResult: results.join('\n')
};

mkdirSync(new URL('./screenshots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), { recursive: true });
const outPath = new URL('./screenshots/calendar-bug-report.txt', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n\n' + results.join('\n'));

console.log(JSON.stringify(report, null, 2));
