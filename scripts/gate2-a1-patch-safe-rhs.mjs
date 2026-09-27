#!/usr/bin/env node
/**
 * Gate 2 A1 — surgical Mode RHS patch for TGT-EmailFeed-IN export.
 *
 * Usage (after Troy/Claude exports the flow package zip and unzips it):
 *   node scripts/gate2-a1-patch-safe-rhs.mjs /path/to/unzipped-or-definition.json
 *
 * Finds definition.json under the given path (or uses the file itself), then
 * replaces ONLY the Mode Value equals RHS "RUN" → "SAFE" on the Get_items_2
 * Mode path. Does not rebuild the flow, rename it, or touch other literals.
 *
 * Dry-run by default. Pass --write to mutate the file in place.
 * Exit 0 on success; non-zero if zero or ambiguous matches.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const write = args.includes('--write');
const targetArg = args.find((a) => !a.startsWith('--'));

if (!targetArg) {
  console.error(
    'Usage: node scripts/gate2-a1-patch-safe-rhs.mjs <export-dir-or-definition.json> [--write]',
  );
  process.exit(2);
}

const MODE_LHS =
  "@first(outputs('Get_items_2')?['body/value'])?['Mode']?['Value']";

function findDefinitionJson(root) {
  const st = fs.statSync(root);
  if (st.isFile()) {
    if (path.basename(root) === 'definition.json' || root.endsWith('.json')) {
      return root;
    }
    throw new Error(`Not a JSON definition: ${root}`);
  }
  const stack = [root];
  const hits = [];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const s = fs.statSync(full);
      if (s.isDirectory()) stack.push(full);
      else if (name === 'definition.json') hits.push(full);
    }
  }
  if (hits.length === 0) throw new Error(`No definition.json under ${root}`);
  if (hits.length > 1) {
    console.error('Multiple definition.json files:');
    for (const h of hits) console.error(`  ${h}`);
    throw new Error('Pass the exact definition.json path');
  }
  return hits[0];
}

function patchEqualsRhs(obj, stats) {
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) patchEqualsRhs(item, stats);
    return;
  }

  if (
    Object.prototype.hasOwnProperty.call(obj, 'equals') &&
    Array.isArray(obj.equals) &&
    obj.equals.length === 2
  ) {
    const [lhs, rhs] = obj.equals;
    if (lhs === MODE_LHS && rhs === 'RUN') {
      stats.matches.push({ pathHint: 'equals[Mode Value, RUN]' });
      if (write) obj.equals[1] = 'SAFE';
    } else if (lhs === MODE_LHS && rhs === 'SAFE') {
      stats.alreadySafe += 1;
    }
  }

  // also handle not.equals wrappers — do not change those in A1
  for (const key of Object.keys(obj)) {
    if (key === 'equals') continue;
    patchEqualsRhs(obj[key], stats);
  }
}

const defPath = findDefinitionJson(path.resolve(targetArg));
const raw = fs.readFileSync(defPath, 'utf8');
const json = JSON.parse(raw);
const stats = { matches: [], alreadySafe: 0 };

patchEqualsRhs(json, stats);

if (stats.alreadySafe > 0 && stats.matches.length === 0) {
  console.log(`OK: ${defPath} already has Mode Value equals "SAFE" (${stats.alreadySafe}).`);
  process.exit(0);
}

if (stats.matches.length === 0) {
  console.error(
    `FAIL: no Mode Value equals "RUN" found for Get_items_2 in ${defPath}`,
  );
  process.exit(1);
}

if (stats.matches.length > 1) {
  console.error(
    `FAIL: ambiguous — ${stats.matches.length} Mode Value equals "RUN" sites; refusing to patch`,
  );
  process.exit(1);
}

if (!write) {
  console.log(`DRY-RUN: would patch 1 site in ${defPath}`);
  console.log('  equals[Mode Value, "RUN"] → equals[Mode Value, "SAFE"]');
  console.log('Re-run with --write to apply.');
  process.exit(0);
}

fs.writeFileSync(defPath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
console.log(`WROTE: ${defPath}`);
console.log('Next: re-zip package → Import as update of TGT-EmailFeed-IN (same name) → Code view reload must show "SAFE".');
