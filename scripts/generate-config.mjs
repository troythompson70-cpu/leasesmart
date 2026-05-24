/**
 * Generate config.js from .env (local only). Run: node scripts/generate-config.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(ROOT, '.env');
const outPath = path.join(ROOT, 'config.js');

if (!existsSync(envPath)) {
  console.error('Missing .env — copy .env.example and set SUPABASE_URL + SUPABASE_ANON_KEY.');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const url = env.SUPABASE_URL || '';
const key = env.SUPABASE_ANON_KEY || '';
if (!url || url.includes('YOUR_') || !key || key.includes('YOUR_')) {
  console.error('.env must contain real SUPABASE_URL and SUPABASE_ANON_KEY (not placeholders).');
  process.exit(1);
}

const body = `/**
 * LeaseSmart Supabase config — LOCAL ONLY (gitignored). Anon key ONLY.
 */
window.LEASESMART_CONFIG = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)}
};
`;

writeFileSync(outPath, body, 'utf8');
console.log('Wrote config.js (gitignored).');
