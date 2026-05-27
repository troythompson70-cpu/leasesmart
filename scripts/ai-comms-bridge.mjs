/**
 * Sprint F1 — AI shared sprint log bridge (append-only, sanitized)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sanitize } from './sprint-log-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const AI_COMMS_DIR = join(ROOT, 'master-vault', 'ai-comms');
export const AI_SHARED_LOG = join(AI_COMMS_DIR, 'AI-SHARED-LOG.json');

export const VALID_SOURCES = ['claude', 'chatgpt', 'cursor', 'gemini', 'troy'];
export const VALID_TYPES = ['command', 'review', 'verdict', 'report'];
export const VALID_VERDICTS = ['GO', 'NO-GO', 'PENDING'];

function ensureAiCommsDir() {
  mkdirSync(AI_COMMS_DIR, { recursive: true });
  if (!existsSync(AI_SHARED_LOG)) {
    writeFileSync(AI_SHARED_LOG, JSON.stringify({ version: 1, appendOnly: true, entries: [] }, null, 2) + '\n', 'utf8');
  }
}

export function readAiSharedLog() {
  ensureAiCommsDir();
  const raw = readFileSync(AI_SHARED_LOG, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.entries) ? data.entries : [];
}

export function validateAiLogEntry(entry) {
  if (!entry || typeof entry !== 'object') return 'Entry must be an object';
  if (!entry.sprint || !entry.phase) return 'sprint and phase required';
  if (VALID_SOURCES.indexOf(entry.source) < 0) return 'Invalid source';
  if (VALID_TYPES.indexOf(entry.type) < 0) return 'Invalid type';
  if (!entry.content || typeof entry.content !== 'string') return 'content required';
  if (VALID_VERDICTS.indexOf(entry.verdict) < 0) return 'Invalid verdict';
  if (typeof entry.commit_phrase_required !== 'boolean') return 'commit_phrase_required must be boolean';
  return null;
}

/** Append only — never modifies prior entries. */
export function appendAiLogEntry(entry) {
  ensureAiCommsDir();
  const err = validateAiLogEntry(entry);
  if (err) throw new Error(err);

  const safeContent = sanitize(entry.content);
  if (safeContent !== entry.content && /\[REDACTED/.test(safeContent)) {
    throw new Error('Refusing to log entry: content appears to contain secrets after sanitization');
  }

  const record = {
    timestamp: entry.timestamp || new Date().toISOString(),
    sprint: sanitize(String(entry.sprint)),
    phase: sanitize(String(entry.phase)),
    source: entry.source,
    type: entry.type,
    content: safeContent,
    verdict: entry.verdict,
    commit_phrase_required: entry.commit_phrase_required,
  };

  const raw = readFileSync(AI_SHARED_LOG, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.entries)) data.entries = [];
  data.entries.push(record);
  writeFileSync(AI_SHARED_LOG, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return { ok: true, path: AI_SHARED_LOG, index: data.entries.length - 1, entry: record };
}

export function filterAiLogBySource(entries, source, limit) {
  return entries.filter(function(e) { return e.source === source; }).slice(-(limit || 5));
}
