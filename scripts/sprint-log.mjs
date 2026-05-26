#!/usr/bin/env node
/**
 * LeaseSmart Sprint Logger — append to master-vault markdown log
 *
 * Usage:
 *   node scripts/sprint-log.mjs command "Sprint B2 — build logger" --sprint B2
 *   node scripts/sprint-log.mjs cursor-report "Built morning checklist..." --sprint B2
 *   node scripts/sprint-log.mjs claude-review "All checks pass" --verdict GO --sprint B2
 *   node scripts/sprint-log.mjs go-no-go "Wait for Troy commit phrase" --verdict NO-GO --sprint B2
 */
import { appendLogEntry, sanitize, MASTER_LOG } from './sprint-log-lib.mjs';

const args = process.argv.slice(2);
const type = args[0];
const valid = ['command', 'cursor-report', 'claude-review', 'go-no-go'];

if (!type || !valid.includes(type)) {
  console.error('Usage: node scripts/sprint-log.mjs <command|cursor-report|claude-review|go-no-go> "text" [--sprint ID] [--verdict GO|NO-GO]');
  process.exit(1);
}

let text = '';
let sprint = '';
let verdict = '';
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--sprint' && args[i + 1]) { sprint = args[++i]; continue; }
  if (args[i] === '--verdict' && args[i + 1]) { verdict = args[++i]; continue; }
  if (!text) text = args[i];
  else text += ' ' + args[i];
}

if (!text) {
  console.error('Missing log body text.');
  process.exit(1);
}

const result = appendLogEntry(type, text, { sprint: sprint || undefined, verdict: verdict || undefined });
console.log(JSON.stringify({ ok: true, file: result.path, type: result.type, sanitized_preview: sanitize(text).slice(0, 120) }, null, 2));
