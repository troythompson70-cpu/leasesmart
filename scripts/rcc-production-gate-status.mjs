#!/usr/bin/env node
/**
 * Production path gate status for TGT Command Center.
 * Fail-closed. Never invents GREEN. Never prints secrets.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const website = path.join(root, 'tgt-website');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(website, '.env')),
  ...loadEnvFile(path.join(website, '.env.local')),
  ...process.env,
};

const GRAPH_NAMES = [
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
  'GRAPH_ACCESS_TOKEN',
  'GRAPH_REFRESH_TOKEN',
];

function present(name) {
  const v = String(env[name] || '').trim();
  if (!v) return false;
  if (/^YOUR_|placeholder|changeme|example/i.test(v)) return false;
  return true;
}

const presentNames = GRAPH_NAMES.filter(present);
const authReady =
  present('GRAPH_ACCESS_TOKEN') ||
  (present('GRAPH_TENANT_ID') && present('GRAPH_CLIENT_ID') && present('GRAPH_CLIENT_SECRET')) ||
  (present('GRAPH_TENANT_ID') && present('GRAPH_CLIENT_ID') && present('GRAPH_REFRESH_TOKEN'));

const healthUrl = process.env.RCC_HEALTH_URL || 'http://127.0.0.1:5173/api/health';
let health = null;
try {
  const res = await fetch(healthUrl, { cache: 'no-store' });
  health = { http: res.status, body: await res.json().catch(() => ({})) };
} catch (err) {
  health = { http: 0, body: { error: String(err && err.message ? err.message : err) } };
}

const currentGate = !authReady
  ? 'Graph AUTH'
  : health?.body?.mailbox_coverage === 'PASS' ||
      health?.body?.checks?.mailbox_coverage === 'PASS' ||
      health?.body?.probes?.mailbox_coverage?.status === 'PASS'
    ? 'SharePoint live READ / WRITE chain'
    : 'live Inbox GET (mailbox_coverage)';

const lastPass = authReady
  ? 'Graph env present (values not printed)'
  : 'NONE — Graph secrets absent in this agent environment';

const currentFailure = !authReady
  ? 'MISSING_GRAPH_SECRETS — cannot run live Inbox GET / SharePoint read / write / readback'
  : health?.http !== 200
    ? `Health probe HTTP ${health?.http}: ${health?.body?.error || 'see /api/health'}`
    : 'Awaiting independent probe of mailbox_coverage + feed readback';

const nextAutomatic =
  !authReady
    ? 'After Troy completes graph:login (or injects GRAPH_*), re-run health → Inbox GET → SharePoint read → decision write/readback'
    : 'Probe /api/health mailbox_coverage then /api/dashboard-feed then POST /api/opportunity-decision';

const ownerAction = !authReady
  ? [
      '1) On a machine with browser MFA: cd tgt-website && npm run graph:login',
      '   Complete device-code sign-in; saves refresh token to tgt-website/.env.local (gitignored).',
      '2) OR inject into Cloud Agent / AppDeploy secrets (do not paste into chat):',
      '   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, and GRAPH_CLIENT_SECRET (app) OR GRAPH_REFRESH_TOKEN (delegated).',
      '3) For mailbox GREEN: ensure Mail.Read application permission + admin consent',
      '   (or delegated Mail.Read if using a token that includes it). UPN: tgates@tgttechnologies.com.',
      '4) AppDeploy AUTH_TEST: apply PR #28 graph-auth drop-in + Reconcile (AADSTS900023 tenant repair).',
      '5) Gate 1: provide PA HTTP evidence for TGT-EmailFeed-IN (PR #30) — URI/headers redacted.',
    ].join('\n')
  : 'If mailbox_coverage BLOCKED: grant Mail.Read + consent / AppAccessPolicy. If SharePoint read fails: Sites.ReadWrite.All.';

console.log(`RUNNING AGENTS: production-path (UI frozen)
CURRENT GATE: ${currentGate}
LAST PASS: ${lastPass}
CURRENT FAILURE: ${currentFailure}
NEXT AUTOMATIC ACTION: ${nextAutomatic}
OWNER ACTION REQUIRED:
${ownerAction}

graph_env_present: ${presentNames.join(', ') || '(none)'}
health_http: ${health?.http}
end_to_end: FAILED (chain incomplete until live Outlook→SharePoint→readback→RCC→decision→readback)`);
