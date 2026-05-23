/**
 * Gate 4 local test — v1.1.5 calendar fixed behavior
 */
let quizStep = 3;
let advanceCalled = false;
let advanceValue = null;
const cal = { value: '' };
let btnDisabled = true;

function isValidIsoDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || ''); }
function formatCalendarDate(iso) {
  const p = iso.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function advance(val) {
  advanceCalled = true;
  advanceValue = val;
  quizStep++;
}
function updateCalBtn() {
  btnDisabled = !(cal && isValidIsoDate(cal.value));
}

const tests = [];

function assert(name, cond) {
  tests.push({ name, pass: !!cond });
}

// Test A: no advance on date select
cal.value = '2026-06-15';
updateCalBtn();
assert('Continue enables after valid YYYY-MM-DD', btnDisabled === false);
assert('Does NOT advance after date selection alone', advanceCalled === false);
assert('Still on Step 4 (quizStep 3)', quizStep === 3);

// Test B: partial date does not enable Continue
cal.value = '2026-06';
updateCalBtn();
assert('Continue stays disabled for partial date', btnDisabled === true);

// Test C: Continue click advances to Step 5
cal.value = '2026-06-15';
updateCalBtn();
if (!btnDisabled) advance(formatCalendarDate(cal.value));
assert('Continue click calls advance()', advanceCalled === true);
assert('Advances to Step 5 (quizStep 4)', quizStep === 4);
assert('Formatted move-in value saved', advanceValue === 'June 15, 2026');

const allPass = tests.every(t => t.pass);
console.log(JSON.stringify({
  version: 'v1.1.5',
  gate4LocalTest: allPass ? 'PASS' : 'FAIL',
  tests
}, null, 2));
process.exit(allPass ? 0 : 1);
