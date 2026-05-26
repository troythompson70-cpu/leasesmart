#!/usr/bin/env node
/**
 * LeaseSmart Morning Review Checklist — plain English for Troy (< 2 min read)
 * Runs A6 + C1 regression tests, reads git status + recent sprint log.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ensureVault,
  readBuildId,
  readRecentLogSections,
  sanitize,
  MORNING_LATEST,
  MASTER_LOG,
} from './sprint-log-lib.mjs';
import { handoffReportHtml, wrapHandoffBlock } from './handoff-copy-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
const HANDOFF_HTML = join(ROOT, 'master-vault', 'morning', 'HANDOFF-latest.html');

function runTest(file) {
  const r = spawnSync('node', [join(QA, file)], { encoding: 'utf8', cwd: QA });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return {
    file: file,
    exit: r.status,
    result: json ? json.result : (r.status === 0 ? 'PASS' : 'FAIL'),
    passed: json ? json.passed : null,
    total: json ? json.total : null,
    failed: json && json.failed ? json.failed : [],
  };
}

function gitLines(cmd) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: ROOT });
  return (r.stdout || '').trim();
}

function inferFromLog(sections) {
  const built = [];
  const review = [];
  const ready = [];
  const wait = [];
  sections.forEach(function(sec) {
    const lower = sec.toLowerCase();
    if (lower.includes('cursor report') || lower.includes('sprint command')) {
      const line = sec.split('\n').find(function(l) { return l.trim() && !l.startsWith('#') && !l.startsWith('**'); });
      if (line) built.push(line.trim().slice(0, 120));
    }
    if (lower.includes('claude review') && !lower.includes('verdict:** go')) {
      review.push('Claude review pending or needs follow-up');
    }
    if (lower.includes('verdict:** go') && lower.includes('go / no-go')) {
      ready.push('Item marked GO — waiting for Troy commit phrase only');
    }
    if (lower.includes('verdict:** no-go') || lower.includes('not committed')) {
      wait.push('NO-GO or not approved for commit yet');
    }
    if (lower.includes('draft sql') || lower.includes('not applied live')) {
      wait.push('Draft SQL — do not apply to Supabase without approval');
    }
  });
  return { built, review, ready, wait };
}

ensureVault();
const buildId = readBuildId();
const a6 = runTest('sprint-a6-regression-test.mjs');
const c1 = runTest('sprint-c1-regression-test.mjs');
const tests = [a6, c1];
const allPass = tests.every(function(t) { return t.result === 'PASS'; });

const status = gitLines('git status --short 2>/dev/null');
const branch = gitLines('git branch --show-current 2>/dev/null') || 'main';
const uncommitted = status ? status.split('\n').filter(Boolean) : [];
const recent = readRecentLogSections(6);
const inferred = inferFromLog(recent);

const dateLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const whatBuilt = inferred.built.length
  ? inferred.built
  : ['Sprint B2 — documentation logger + morning checklist (see master-vault/)'];

const whatFailed = tests.filter(function(t) { return t.result !== 'PASS'; }).map(function(t) {
  return t.file + ': ' + (t.failed.length ? t.failed.join(', ') : 'FAILED');
});

const needsReview = [...new Set(inferred.review)];
if (!allPass) needsReview.push('Fix failing regression tests before commit');
if (uncommitted.length) needsReview.push('Review uncommitted files on disk (' + uncommitted.length + ' items)');

const readyCommit = [];
if (allPass && !needsReview.some(function(x) { return x.toLowerCase().includes('no-go'); })) {
  if (uncommitted.length) readyCommit.push('Code is tested — say exact commit phrase when Troy approves');
  else readyCommit.push('Nothing new to commit locally');
} else {
  readyCommit.push('Not ready — fix failures or get Claude GO first');
}

const needsWait = [...new Set([
  ...inferred.wait,
  'Never commit until Troy says the exact commit phrase',
  'Never apply Supabase migrations without explicit approval',
  'Never paste API keys into logs or chat',
])];

const md = [
  '# Morning Review — ' + dateLabel,
  '',
  '**LeaseSmart · TGT Technologies Inc.**',
  '**Build ID:** ' + buildId + ' · **Branch:** ' + branch,
  '',
  '> Read this in under 2 minutes. Upload `master-vault/` files to Microsoft 365 Master Vault.',
  '',
  '## What was built',
  ...whatBuilt.map(function(b) { return '- ' + sanitize(b.slice(0, 200)); }),
  '',
  '## What passed',
  ...tests.map(function(t) {
    const score = t.passed != null ? ' (' + t.passed + '/' + t.total + ')' : '';
    return '- **' + t.file.replace('.mjs', '') + ':** ' + t.result + score;
  }),
  '- **JS syntax:** assumed OK if regression scripts ran',
  '',
  '## What failed',
  ...(whatFailed.length ? whatFailed.map(function(f) { return '- ' + f; }) : ['- Nothing — all regression tests passed']),
  '',
  '## What needs review',
  ...(needsReview.length ? needsReview.map(function(r) { return '- ' + sanitize(r); }) : ['- No open review items from recent log']),
  '',
  '## Ready for commit',
  ...readyCommit.map(function(r) { return '- ' + r; }),
  '',
  '## What needs to wait',
  ...needsWait.map(function(w) { return '- ' + w; }),
  '',
  '---',
  '',
  '**Uncommitted files:** ' + (uncommitted.length ? uncommitted.length : '0'),
  '',
  uncommitted.length ? '```\n' + sanitize(status) + '\n```' : '_Working tree clean or git unavailable._',
  '',
  '**Full sprint log:** `master-vault/LeaseSmart-Sprint-Master-Log.md`',
  '',
  '**Copy for Claude:** open `master-vault/morning/HANDOFF-latest.html` and click the button.',
  '',
].join('\n');

const handoffBody = [
  'Project: LeaseSmart',
  'Sprint: Morning Review',
  'Build ID: ' + buildId,
  'Status: ' + (uncommitted.length ? 'UNCOMMITTED CHANGES' : 'CLEAN'),
  'What was built:',
  ...whatBuilt.map(function(b) { return '- ' + sanitize(b.slice(0, 200)); }),
  'What passed:',
  ...tests.map(function(t) {
    const score = t.passed != null ? ' (' + t.passed + '/' + t.total + ')' : '';
    return '- ' + t.file.replace('.mjs', '') + ': ' + t.result + score;
  }),
  'What failed:',
  ...(whatFailed.length ? whatFailed : ['- Nothing']),
  'What needs review:',
  ...(needsReview.length ? needsReview : ['- None']),
  'Ready for commit:',
  ...readyCommit,
  'What needs to wait:',
  ...needsWait,
].join('\n');

writeFileSync(MORNING_LATEST, md, 'utf8');
writeFileSync(HANDOFF_HTML, handoffReportHtml('Morning Review Handoff — ' + dateLabel, handoffBody), 'utf8');
console.log(JSON.stringify({
  ok: true,
  morning_review: MORNING_LATEST,
  handoff_html: HANDOFF_HTML,
  master_log: MASTER_LOG,
  build_id: buildId,
  regression: { a6: a6.result, c1: c1.result, all_pass: allPass },
  uncommitted_count: uncommitted.length,
}, null, 2));

process.exit(allPass ? 0 : 1);
