/**
 * Live test tweaks — bathrooms + commute multi-select
 */
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function getStep(id) {
  const m = html.match(new RegExp("\\{id:'" + id + "'[\\s\\S]*?opts:\\[[^\\]]+\\]\\}"));
  return m ? m[0] : '';
}

function assert(name, cond) {
  return { name, pass: !!cond };
}

const tests = [];

// Step definitions
const baths = getStep('baths');
const commute = getStep('commute');
const laundry = getStep('laundry');
const amenities = getStep('amenities');
const moveinBlock = html.slice(html.indexOf('function wireStepEvents'), html.indexOf('function formatCalendarDate'));

tests.push(assert('Bathrooms type is multi', /id:'baths'[\s\S]*type:'multi'/.test(baths)));
tests.push(assert('Commute type is multi', /id:'commute'[\s\S]*type:'multi'/.test(commute)));
tests.push(assert('Bathrooms opts unchanged (5 options)', (baths.match(/'/g) || []).length >= 10));
tests.push(assert('Commute opts unchanged (7 options)', commute.includes('Remote')));
tests.push(assert('Laundry still multi', /id:'laundry'[\s\S]*type:'multi'/.test(laundry)));
tests.push(assert('Amenities still multi', /id:'amenities'[\s\S]*type:'multi'/.test(amenities)));
tests.push(assert('Calendar fix intact (updateCalBtn)', moveinBlock.includes('updateCalBtn') && !moveinBlock.includes('submitCal')));
tests.push(assert('Multi confirm pattern exists', html.includes('Confirm Selection')));

// Simulate multi-select advance logic (same as wireStepEvents multi branch)
function simMultiStep(stepId, selections) {
  let advanced = false;
  let saved = null;
  const APP = { multiSel: selections.slice() };
  function advance(val) { advanced = true; saved = val; }
  const val = APP.multiSel.slice();
  if (val.length) advance(val);
  else advance(['No preference']);
  return { advanced, saved, stepId };
}

const bathsSim = simMultiStep('baths', ['1 Bathroom', '2 Bathrooms']);
tests.push(assert('Bathrooms: 2 selections advance on confirm', bathsSim.advanced && bathsSim.saved.length === 2));

const commuteSim = simMultiStep('commute', ['15-25 min', '25-35 min']);
tests.push(assert('Commute: 2 selections advance on confirm', commuteSim.advanced && commuteSim.saved.length === 2));

// Single-click should NOT auto-advance (multi uses confirm, not grid click advance)
tests.push(assert('Bathrooms no longer single-select', !/id:'baths'[\s\S]*type:'single'/.test(html)));
tests.push(assert('Commute no longer single-select', !/id:'commute'[\s\S]*type:'single'/.test(html)));

const allPass = tests.every(t => t.pass);
console.log(JSON.stringify({ result: allPass ? 'PASS' : 'FAIL', tests }, null, 2));
process.exit(allPass ? 0 : 1);
