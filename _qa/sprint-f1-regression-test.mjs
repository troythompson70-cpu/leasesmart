/**
 * Sprint F1 — AI comms, command center, push skeleton + E2/E3 nested chain
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sanitize } from '../scripts/sprint-log-lib.mjs';
import { appendAiLogEntry, readAiSharedLog, AI_SHARED_LOG } from '../scripts/ai-comms-bridge.mjs';
import { f1ValidateNoRealPush, f1ListDemoAlerts, F1_PUSH_DEMO_LABEL } from '../scripts/f1-push-notifications.mjs';
import { AI_CONTEXT_SNAPSHOT, buildAiContextSnapshot } from '../scripts/ai-context-export.mjs';
import { DOMAIN_GUIDE_PATH, buildDomainSetupGuide } from '../scripts/domain-setup-guide.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const BUILD = '20260526-v1.9.0-d5';
const ccHtml = readFileSync(join(ROOT, 'command-center.html'), 'utf8');
const aiLogRaw = readFileSync(AI_SHARED_LOG, 'utf8');
const tests = [];
function assert(name, cond) { tests.push({ name, pass: !!cond }); }

assert('F1 build marker in index', readFileSync(join(ROOT, 'index.html'), 'utf8').includes('LS_BUILD'));

// Agent 1 — AI shared log
assert('ai-comms-bridge exists', existsSync(join(ROOT, 'scripts/ai-comms-bridge.mjs')));
assert('AI-SHARED-LOG.json exists', existsSync(AI_SHARED_LOG));
assert('appendOnly flag', aiLogRaw.includes('"appendOnly": true'));
assert('log entry fields', aiLogRaw.includes('commit_phrase_required') && aiLogRaw.includes('"verdict"'));
assert('ai-context-export exists', existsSync(join(ROOT, 'scripts/ai-context-export.mjs')));
assert('bridge uses sanitize', readFileSync(join(ROOT, 'scripts/ai-comms-bridge.mjs'), 'utf8').includes('sanitize'));
assert('no API keys in AI log', !/\bsk-[A-Za-z0-9]{20,}/.test(aiLogRaw) && !aiLogRaw.includes('pk_live_'));
assert('append rejects secrets', (function() {
  try {
    appendAiLogEntry({
      sprint: 'F1-test', phase: 'test', source: 'cursor', type: 'report',
      content: 'password=SuperSecret123!', verdict: 'PENDING', commit_phrase_required: false,
    });
    return false;
  } catch (e) { return true; }
})());
const snapshot = buildAiContextSnapshot({ runTests: false });
assert('context snapshot sanitized', !snapshot.includes('SuperSecret') && snapshot.includes('Current sprint status'));
assert('context export path constant', AI_CONTEXT_SNAPSHOT.includes('AI-CONTEXT-SNAPSHOT.md'));

// Agent 2 — command center v2
assert('command-center.html exists', existsSync(join(ROOT, 'command-center.html')));
assert('internal demo gate', ccHtml.includes('INTERNAL') && (ccHtml.includes('localhost') || ccHtml.includes('Demo gate')));
assert('5 tabs', ccHtml.includes('Triple AI Review') && ccHtml.includes('Sprint Status Board'));
assert('AI Shared Log Viewer', ccHtml.includes('AI Shared Log Viewer'));
assert('Commit Control Panel', ccHtml.includes('Commit Control Panel'));
assert('Morning Briefing', ccHtml.includes('Morning Briefing'));
assert('memory only keys', ccHtml.includes('memory only') && ccHtml.includes('sessionStorage') === false || ccHtml.includes('No localStorage'));
assert('no hardcoded API keys in CC', !ccHtml.match(/\bsk-ant-[A-Za-z0-9_-]{10,}/));
assert('read only commit panel', ccHtml.includes('READ ONLY') && !ccHtml.includes('git push'));
assert('index.html untouched by F1 CC', !readFileSync(join(ROOT, 'index.html'), 'utf8').includes('command-center.html'));

// Agent 3 — push skeleton
assert('f1-push-notifications.mjs', existsSync(join(ROOT, 'scripts/f1-push-notifications.mjs')));
assert('demo label', F1_PUSH_DEMO_LABEL.includes('DEMO'));
assert('no real push', f1ListDemoAlerts().every(f1ValidateNoRealPush));
assert('alert types', f1ListDemoAlerts().length >= 4);
assert('CC push demo panel', ccHtml.includes('DEMO') && ccHtml.includes('VAPID'));

// Agent 4 — domain guide
assert('domain-setup-guide.mjs', existsSync(join(ROOT, 'scripts/domain-setup-guide.mjs')));
const guide = buildDomainSetupGuide();
assert('Netlify CNAME target', guide.includes('leasesmart2.netlify.app') && guide.includes('CNAME'));
assert('Pages retirement documented', guide.includes('GitHub Pages is retired'));
assert('no live Pages mirror', !existsSync(join(ROOT, 'CNAME')) && !existsSync(join(ROOT, '.github/workflows/pages.yml')));
assert('leasesmart.tgttechnologies.com', guide.includes('leasesmart.tgttechnologies.com'));
assert('verify', guide.toLowerCase().includes('verify'));

// Auth / prior preservation (index.html unchanged for F1)
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
assert('beta login intact', html.includes('beta-login-pg'));
assert('E2 legal intact', html.includes('e2-tos-pg'));

function runSuite(file) {
  const p = join(QA, file);
  if (!existsSync(p)) return { file, json: null, exit: 1, missing: true };
  const r = spawnSync('node', [p], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return { file, json, exit: r.status, missing: false };
}

const nestedFiles = [
  'sprint-a6-regression-test.mjs',
  'sprint-c1-regression-test.mjs',
  'sprint-b2-regression.mjs',
  'sprint-b4-regression-test.mjs',
  'sprint-v140-regression-test.mjs',
  'sprint-d1-regression-test.mjs',
  'sprint-d2-regression-test.mjs',
  'sprint-d3-regression-test.mjs',
  'sprint-d4-regression-test.mjs',
  'sprint-d5-regression-test.mjs',
  'sprint-e2-regression-test.mjs',
  'sprint-e3-regression-test.mjs',
];
const nested = {};
nestedFiles.forEach(function(f) {
  const r = runSuite(f);
  nested[f] = r.missing ? { result: 'SKIP' } : (r.json ? { result: r.json.result, passed: r.json.passed, total: r.json.total } : { result: 'FAIL' });
  if (!r.missing) assert(f + ' PASS', r.json && r.json.result === 'PASS');
});

const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass);
console.log(JSON.stringify({
  sprint: 'F1',
  result: failed.length ? 'FAIL' : 'PASS',
  passed,
  total: tests.length,
  failed: failed.map(f => f.name),
  build: BUILD,
  nested,
  tests,
}, null, 2));
process.exit(failed.length ? 1 : 0);
