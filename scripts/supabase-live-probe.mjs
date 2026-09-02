#!/usr/bin/env node
/**
 * Read-only probe of the Supabase project the shipped app points at.
 *
 * Answers three questions without dashboard access: does the configured project ref
 * resolve, is email auth enabled on it, and what can the anon role read. Every request is
 * a GET with the public anon key, so this only ever sees what a browser visitor sees.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 10000;

/** Tables the app's sprints define, so a missing one is visible rather than assumed. */
export const PROBE_TABLES = [
  'users',
  'profiles',
  'gov_listings',
  'listings',
  'organizations',
  'organization_staff',
  'organization_invites',
  'organization_audit_logs',
  'case_manager_clients',
  'agencies',
  'agency_users',
  'case_clients',
  'case_notes',
  'client_assignments',
  'landlord_intelligence',
  'in_app_notifications',
  'notification_outbox',
];

export function readShippedConfig(html) {
  const url = (html.match(/var SUPABASE_URL='([^']+)'/) || [])[1] || '';
  const key = (html.match(/var SUPABASE_ANON_KEY='([^']+)'/) || [])[1] || '';
  return { url, key, ref: (url.match(/https:\/\/([^.]+)\./) || [])[1] || '' };
}

async function get(url, key, extraHeaders) {
  const headers = Object.assign({ apikey: key, Authorization: 'Bearer ' + key }, extraHeaders || {});
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { status: res.status, body: await res.text(), headers: res.headers };
  } catch (e) {
    return { status: 0, body: String(e && e.message || e), headers: null };
  }
}

/**
 * A ref that does not resolve gives status 0 (DNS failure), not an HTTP error, so the two
 * are reported separately — "unreachable" and "rejected the key" are different problems.
 */
export async function probeProject(url, key) {
  const health = await get(url + '/auth/v1/health', key);
  if (health.status === 0) return { reachable: false, detail: health.body };
  const settings = await get(url + '/auth/v1/settings', key);
  let auth = null;
  try {
    const s = JSON.parse(settings.body);
    auth = {
      emailEnabled: !!(s.external && s.external.email),
      signupEnabled: s.disable_signup === false,
      mailerAutoconfirm: !!s.mailer_autoconfirm,
    };
  } catch (e) { /* non-JSON body reported via status below */ }
  return { reachable: true, healthStatus: health.status, settingsStatus: settings.status, auth };
}

/**
 * Classifies anon access per table. `missing` means the table is not in the live schema at
 * all, which is not the same as RLS denying access — the distinction matters when checking
 * whether an authorization boundary exists server-side.
 */
export async function probeTables(url, key, tables) {
  const out = {};
  for (const t of tables) {
    const r = await get(url + '/rest/v1/' + t + '?select=*&limit=1', key, { Prefer: 'count=exact', Range: '0-0' });
    if (r.status === 0) { out[t] = { access: 'unreachable' }; continue; }
    if (r.status === 404 && r.body.includes('PGRST205')) { out[t] = { access: 'missing' }; continue; }
    if (r.status === 401 || r.status === 403) { out[t] = { access: 'denied', status: r.status }; continue; }
    // A ranged request with an exact count answers 206 Partial Content, not 200.
    if (r.status === 200 || r.status === 206) {
      const range = r.headers ? r.headers.get('content-range') : null;
      const total = range ? Number(String(range).split('/')[1]) : null;
      out[t] = { access: total ? 'anon_readable' : 'anon_empty', rows: Number.isFinite(total) ? total : null };
      continue;
    }
    out[t] = { access: 'unexpected', status: r.status };
  }
  return out;
}

export async function runProbe() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const cfg = readShippedConfig(html);
  if (!cfg.url || !cfg.key) throw new Error('Could not read SUPABASE_URL / SUPABASE_ANON_KEY from index.html');
  const project = await probeProject(cfg.url, cfg.key);
  const tables = project.reachable ? await probeTables(cfg.url, cfg.key, PROBE_TABLES) : {};
  const missing = Object.keys(tables).filter(t => tables[t].access === 'missing');
  const readable = Object.keys(tables).filter(t => tables[t].access === 'anon_readable');
  return {
    ref: cfg.ref,
    project,
    tables,
    summary: {
      probed: Object.keys(tables).length,
      missingFromLiveSchema: missing,
      readableByAnon: readable,
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runProbe().then(r => {
    console.log(JSON.stringify(r, null, 2));
  }).catch(e => {
    console.error(String(e && e.message || e));
    process.exit(1);
  });
}
