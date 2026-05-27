#!/usr/bin/env node
/**
 * Sprint F1 — AI context export (single snapshot any AI can read)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  sanitize,
  readBuildId,
  MASTER_LOG,
  MORNING_LATEST,
  readRecentLogSections,
} from './sprint-log-lib.mjs';
import { readAiSharedLog, filterAiLogBySource } from './ai-comms-bridge.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, '_qa');
export const AI_CONTEXT_SNAPSHOT = join(ROOT, 'master-vault', 'AI-CONTEXT-SNAPSHOT.md');

const REGRESSION_SUITES = [
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
  'sprint-f1-regression-test.mjs',
];

function runSuite(file) {
  const path = join(QA, file);
  if (!existsSync(path)) return { file: file, result: 'SKIP', passed: null, total: null };
  const r = spawnSync('node', [path], { encoding: 'utf8', cwd: QA, timeout: 120000 });
  let json = null;
  try {
    const m = (r.stdout || '').match(/\{[\s\S]*"result"[\s\S]*\}/);
    if (m) json = JSON.parse(m[0]);
  } catch (e) { /* ignore */ }
  return {
    file: file,
    result: json ? json.result : (r.status === 0 ? 'PASS' : 'FAIL'),
    passed: json ? json.passed : null,
    total: json ? json.total : null,
    build: json ? json.build : null,
  };
}

function gitShort(cmd) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: ROOT });
  return sanitize((r.stdout || r.stderr || '').trim());
}

function inferSprintStatus(buildId) {
  const m = buildId.match(/-([a-z]\d+)$/i);
  return m ? m[1].toUpperCase() : 'UNKNOWN';
}

function extractBlockers(entries, gitStatus) {
  const blockers = [];
  if (/^\?\?|^ M/m.test(gitStatus)) blockers.push('Uncommitted local changes on disk');
  entries.filter(function(e) { return e.verdict === 'NO-GO'; }).forEach(function(e) {
    blockers.push('NO-GO: ' + e.sprint + ' — ' + e.content.slice(0, 80));
  });
  entries.filter(function(e) { return e.verdict === 'PENDING'; }).slice(-3).forEach(function(e) {
    blockers.push('PENDING review: ' + e.sprint);
  });
  if (!existsSync(join(ROOT, 'index.html'))) blockers.push('index.html missing');
  return blockers;
}

export function buildAiContextSnapshot(opts) {
  opts = opts || {};
  const runTests = opts.runTests !== false;
  const buildId = readBuildId();
  const gitStatus = gitShort('git status --short 2>/dev/null');
  const gitBranch = gitShort('git branch --show-current 2>/dev/null') || 'unknown';
  const gitAhead = gitShort('git rev-list --count @{u}..HEAD 2>/dev/null') || '0';

  let entries = [];
  try { entries = readAiSharedLog(); } catch (e) { entries = []; }

  const claudeReviews = filterAiLogBySource(entries, 'claude', 5);
  const chatgptDecisions = filterAiLogBySource(entries, 'chatgpt', 5);
  const cursorReports = filterAiLogBySource(entries, 'cursor', 5);

  const testResults = runTests ? REGRESSION_SUITES.map(runSuite) : [];

  const pendingCommits = entries.filter(function(e) {
    return e.verdict === 'GO' && e.commit_phrase_required === true;
  }).map(function(e) { return e.sprint + ' (' + e.timestamp + ')'; });

  const blockers = extractBlockers(entries, gitStatus);

  const lines = [
    '# AI Context Snapshot — LeaseSmart',
    '',
    '**TGT Technologies Inc.** · Generated `' + new Date().toISOString() + '`',
    '',
    '> Any AI reading this file gets full project state. All content sanitized — no API keys.',
    '',
    '## Current sprint status',
    '',
    '- **Build ID:** `' + sanitize(buildId) + '`',
    '- **Active sprint marker:** ' + inferSprintStatus(buildId),
    '- **Branch:** `' + gitBranch + '` · **Commits ahead of remote:** ' + gitAhead,
    '',
    '## Test suite results',
    '',
  ];

  if (testResults.length) {
    testResults.forEach(function(t) {
      const score = t.passed != null ? t.passed + '/' + t.total : '—';
      lines.push('- **' + t.file.replace('.mjs', '') + ':** ' + t.result + ' (' + score + ')');
    });
  } else {
    lines.push('_Tests not run — pass `{ runTests: false }` to skip._');
  }

  lines.push('', '## Last 5 Claude reviews', '');
  if (claudeReviews.length) {
    claudeReviews.forEach(function(e) {
      lines.push('- `' + e.timestamp + '` **' + e.sprint + '** — ' + sanitize(e.content).slice(0, 200));
    });
  } else lines.push('_None in AI-SHARED-LOG.json yet._');

  lines.push('', '## Last 5 ChatGPT PM decisions', '');
  if (chatgptDecisions.length) {
    chatgptDecisions.forEach(function(e) {
      lines.push('- `' + e.timestamp + '` **' + e.sprint + '** — ' + sanitize(e.content).slice(0, 200));
    });
  } else lines.push('_None in AI-SHARED-LOG.json yet._');

  lines.push('', '## Last 5 Cursor reports', '');
  if (cursorReports.length) {
    cursorReports.forEach(function(e) {
      lines.push('- `' + e.timestamp + '` **' + e.sprint + '** — ' + sanitize(e.content).slice(0, 200));
    });
  } else lines.push('_None in AI-SHARED-LOG.json yet._');

  lines.push('', '## Pending commits (GO + phrase required)', '');
  if (pendingCommits.length) {
    pendingCommits.forEach(function(p) { lines.push('- ' + p); });
  } else lines.push('_None marked GO with commit phrase required._');

  lines.push('', '## Open blockers', '');
  if (blockers.length) blockers.forEach(function(b) { lines.push('- ' + b); });
  else lines.push('- None detected');

  lines.push('', '## Git working tree', '', '```', gitStatus || 'clean', '```', '');

  if (existsSync(MORNING_LATEST)) {
    lines.push('## Morning review pointer', '', 'See `' + MORNING_LATEST.replace(ROOT + '/', '') + '`.', '');
  }
  if (existsSync(MASTER_LOG)) {
    const recent = readRecentLogSections(2);
    lines.push('## Recent master log (excerpt)', '');
    recent.forEach(function(sec) { lines.push(sanitize(sec).slice(0, 400), ''); });
  }

  return lines.join('\n');
}

export function writeAiContextSnapshot(opts) {
  mkdirSync(join(ROOT, 'master-vault'), { recursive: true });
  const body = buildAiContextSnapshot(opts);
  writeFileSync(AI_CONTEXT_SNAPSHOT, body + '\n', 'utf8');
  return { path: AI_CONTEXT_SNAPSHOT, bytes: Buffer.byteLength(body, 'utf8') };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const skipTests = process.argv.includes('--skip-tests');
  const r = writeAiContextSnapshot({ runTests: !skipTests });
  console.log(JSON.stringify({ ok: true, ...r }, null, 2));
}
