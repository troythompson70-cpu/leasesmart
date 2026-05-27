/**
 * Sprint E1 — Live Supabase import (service role — local/CI only)
 * Usage: node scripts/e1-live-import.mjs [--dry-run] [--hpd=50] [--nj=50]
 *
 * Requires .env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (never commit)
 *   E1_IMPORT_USER_ID            (public.users.id for catalog owner)
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  e1FetchHpdRegistrations,
  e1FetchHpdContactsForRegistrations,
  e1MapHpdToLandlordIntel,
  e1ValidateRecordNoPii,
  E1_HPD_SOURCE_LABEL,
} from './e1-hpd-api.mjs';
import {
  e1FetchHudNjMultifamily,
  E1_NJ_HRC_LABEL,
  E1_NJ_TARGET_COUNTIES,
} from './e1-nj-hrc-import.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    throw new Error('Missing .env — set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E1_IMPORT_USER_ID');
  }
  const env = {};
  readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(function(line) {
    if (!line || line.startsWith('#')) return;
    const i = line.indexOf('=');
    if (i < 0) return;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return env;
}

function parseArgs(argv) {
  const opts = { dryRun: false, hpdLimit: 50, njLimit: 50 };
  argv.forEach(function(arg) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--hpd=')) opts.hpdLimit = parseInt(arg.split('=')[1], 10) || 50;
    else if (arg.startsWith('--nj=')) opts.njLimit = parseInt(arg.split('=')[1], 10) || 50;
  });
  return opts;
}

function toDbRow(rec, userId, sourceLabel) {
  return {
    user_id: userId,
    is_public: true,
    landlord_name: rec.landlord_name,
    property_name: rec.property_name || null,
    address: rec.address || null,
    city: rec.city || null,
    state: rec.state || null,
    zip: rec.zip || null,
    county: rec.county || null,
    phone: rec.phone || '',
    email: rec.email || '',
    website: rec.website || null,
    source_type: rec.source_type || 'public_record',
    source_url: rec.source_url || null,
    verification_status: 'Imported',
    availability_status: rec.availability_status || 'Unknown',
    program_notes: (sourceLabel + '. ' + (rec.program_notes || '')).trim(),
    warning_flags: rec.warning_flags || ['public_source_only', 'not_verified_claim'],
    neighborhood_notes: rec.neighborhood_notes || 'E1 live import — public source only.',
    next_recheck_date: rec.next_recheck_date || null,
  };
}

async function supabaseInsert(url, serviceKey, rows) {
  const endpoint = url.replace(/\/$/, '') + '/rest/v1/landlord_intelligence';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  if (!res.ok) {
    throw new Error('Supabase insert failed HTTP ' + res.status + ': ' + (typeof body === 'string' ? body : JSON.stringify(body)));
  }
  return body;
}

async function verifyTable(url, serviceKey) {
  const endpoint = url.replace(/\/$/, '') + '/rest/v1/landlord_intelligence?select=id&limit=1';
  const res = await fetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
    },
  });
  if (res.status === 404 || res.status === 406) {
    throw new Error('landlord_intelligence table not found — apply sprint_c1_landlord_intelligence.sql first');
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Supabase connection failed HTTP ' + res.status + ': ' + t);
  }
}

export async function e1RunLiveImport(opts) {
  opts = opts || {};
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = env.E1_IMPORT_USER_ID;
  if (!url || url.includes('YOUR_')) throw new Error('SUPABASE_URL missing or placeholder in .env');
  if (!serviceKey || serviceKey.includes('YOUR_')) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in .env');
  if (!userId) throw new Error('E1_IMPORT_USER_ID missing in .env (public.users.id for public catalog rows)');

  const hpdLimit = opts.hpdLimit != null ? opts.hpdLimit : 50;
  const njLimit = opts.njLimit != null ? opts.njLimit : 50;
  const dryRun = !!opts.dryRun;

  await verifyTable(url, serviceKey);

  const hpdRows = await e1FetchHpdRegistrations(hpdLimit, 0);
  const regIds = hpdRows.map(function(r) { return r.registrationid; });
  const contacts = await e1FetchHpdContactsForRegistrations(regIds);
  const hpdMapped = hpdRows.map(function(r, i) {
    return e1MapHpdToLandlordIntel(r, i, contacts);
  }).filter(e1ValidateRecordNoPii);

  let njMapped = await e1FetchHudNjMultifamily(Math.max(njLimit * 3, 150));
  njMapped = njMapped.slice(0, njLimit).filter(e1ValidateRecordNoPii);

  const dbRows = []
    .concat(hpdMapped.map(function(r) { return toDbRow(r, userId, E1_HPD_SOURCE_LABEL); }))
    .concat(njMapped.map(function(r) { return toDbRow(r, userId, E1_NJ_HRC_LABEL); }));

  const report = {
    dryRun: dryRun,
    hpdFetched: hpdRows.length,
    hpdMapped: hpdMapped.length,
    njMapped: njMapped.length,
    totalToInsert: dbRows.length,
    targetCounties: E1_NJ_TARGET_COUNTIES,
    njNote: 'NJHRC has no public API — NJ rows from HUD multifamily public data filtered to target counties',
  };

  if (dryRun) {
    report.sample = dbRows.slice(0, 3);
    return report;
  }

  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < dbRows.length; i += batchSize) {
    const chunk = dbRows.slice(i, i + batchSize);
    const result = await supabaseInsert(url, serviceKey, chunk);
    inserted += Array.isArray(result) ? result.length : chunk.length;
  }
  report.inserted = inserted;
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const opts = parseArgs(process.argv.slice(2));
  e1RunLiveImport(opts)
    .then(function(report) {
      console.log(JSON.stringify({ result: 'OK', ...report }, null, 2));
    })
    .catch(function(err) {
      console.error(JSON.stringify({ result: 'FAIL', error: err.message }, null, 2));
      process.exit(1);
    });
}
