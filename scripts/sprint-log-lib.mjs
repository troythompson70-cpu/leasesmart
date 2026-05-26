/**
 * LeaseSmart Sprint Log — shared sanitizer + markdown writer (Sprint B2)
 * Never logs API keys, passwords, or service role keys.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const VAULT_DIR = join(ROOT, 'master-vault');
export const MASTER_LOG = join(VAULT_DIR, 'LeaseSmart-Sprint-Master-Log.md');
export const MORNING_LATEST = join(VAULT_DIR, 'morning', 'MORNING-REVIEW-latest.md');

const SECRET_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{10,}/gi,
  /\bsk-proj-[A-Za-z0-9_-]{10,}/gi,
  /\bsk-[A-Za-z0-9]{20,}/gi,
  /\bghp_[A-Za-z0-9]{20,}/gi,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/gi,
  /\bAIza[A-Za-z0-9_-]{20,}/gi,
  /\bsb_[a-z]+_[A-Za-z0-9_-]{20,}/gi,
  /service[_\s-]?role[_\s-]?key[\s:=]+["']?[^\s"'`,]+/gi,
  /SUPABASE_SERVICE[_A-Z]*[\s:=]+["']?[^\s"'`,]+/gi,
  /(?:password|passwd|api[_-]?key|secret|token)[\s:=]+["']?[^\s"'`,]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

const BLOCKLIST_WORDS = ['service_role', 'signInWithPassword'];

export function sanitize(text) {
  let out = String(text || '');
  SECRET_PATTERNS.forEach(function(re) {
    out = out.replace(re, '[REDACTED]');
  });
  BLOCKLIST_WORDS.forEach(function(w) {
    if (new RegExp(w, 'i').test(out) && /key|password|secret|token/i.test(out)) {
      out = out.replace(new RegExp('.{0,40}' + w + '.{0,60}', 'gi'), '[REDACTED — sensitive auth reference]');
    }
  });
  return out.trim();
}

export function nowStamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function ensureVault() {
  mkdirSync(join(VAULT_DIR, 'morning'), { recursive: true });
  if (!existsSync(MASTER_LOG)) {
    writeFileSync(MASTER_LOG, [
      '# LeaseSmart Sprint Master Log',
      '',
      '**TGT Technologies Inc.** — Upload this file to Microsoft 365 Master Vault.',
      '',
      'This log records sprint commands, Claude reviews, GO/NO-GO decisions, and Cursor reports.',
      'Secrets are stripped automatically — never paste API keys or passwords here.',
      '',
      '---',
      '',
    ].join('\n'), 'utf8');
  }
}

export function readBuildId() {
  try {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const m = html.match(/LS_BUILD = '([^']+)'/);
    return m ? m[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

const TYPE_LABELS = {
  command: 'Sprint Command',
  'cursor-report': 'Cursor Report',
  'claude-review': 'Claude Review',
  'go-no-go': 'GO / NO-GO Decision',
};

export function appendLogEntry(type, body, meta) {
  ensureVault();
  meta = meta || {};
  const label = TYPE_LABELS[type] || type;
  const sprint = meta.sprint ? ' — ' + meta.sprint : '';
  const build = meta.build || readBuildId();
  const verdict = meta.verdict ? '\n**Verdict:** ' + sanitize(meta.verdict) + '\n' : '';
  const safeBody = sanitize(body);

  const entry = [
    '## ' + nowStamp() + sprint + ' — ' + label,
    '',
    '**Build ID:** ' + sanitize(build),
    verdict,
    safeBody,
    '',
    '---',
    '',
  ].join('\n');

  appendFileSync(MASTER_LOG, entry, 'utf8');
  return { path: MASTER_LOG, type: label };
}

export function readRecentLogSections(maxSections) {
  if (!existsSync(MASTER_LOG)) return [];
  const raw = readFileSync(MASTER_LOG, 'utf8');
  const parts = raw.split(/^## /m).slice(1);
  return parts.slice(-(maxSections || 8)).map(function(p) { return '## ' + p.trim(); });
}
