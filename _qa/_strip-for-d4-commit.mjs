/**
 * Strip D5 from index.html for Sprint D4 commit only (keeps E2 + D4 + D3).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const inPath = process.argv[2] || join(ROOT, 'index.html.full-stack-backup');
const outPath = process.argv[3] || join(ROOT, 'index.html');
const BUILD = '20260526-v1.8.0-d4';
if (!existsSync(inPath)) { console.error('Missing', inPath); process.exit(1); }
let html = readFileSync(inPath, 'utf8');

function removeBlock(startMarker, endMarker, keepEnd) {
  const start = html.indexOf(startMarker);
  if (start < 0) return false;
  const end = html.indexOf(endMarker, start);
  if (end < 0) return false;
  html = html.slice(0, start) + (keepEnd ? html.slice(end) : html.slice(end + endMarker.length));
  return true;
}

removeBlock('/* D5 — onboarding progress', '/* Sprint D3 — mobile nav');
html = html.replace(/\n  <div id="d5QuizProgressWrap" class="d5-quiz-progress-label">Step 1 of 21<\/div>\n/, '\n');
html = html.replace(/<script src="_data\/sprint-d5-mock-seed\.js"><\/script>\n/g, '');
html = html.replace(/\n  d5UpdateOnboardingProgress\(APP\.quizStep, total\);\n/, '\n');
html = html.replace(/\n  d5HideOnboardingProgress\(\);\n/, '\n');
html = html.replace(/\n  d5ShowToast\([^)]+\);\n/g, '\n');
html = html.replace(/  if \(val\) d5ShowToast\('filter_applied'\);\n/, '');
html = html.replace(/      d5ShowToast\('note_saved'\);\n/g, '');
html = html.replace(/ \+ d5TipHtml\([^)]+\)/g, '');
html = html.replace(/ \+ d5EmptyStateHtml\([^)]+\)/g, '');
html = html.replace(/    el\.innerHTML = d5EmptyStateHtml\([^;]+;\n    return;\n  \}/g,
  "    el.innerHTML = '<p style=\"color:#6b7280;padding:20px\">No listings yet.</p>';\n    return;\n  }");
html = html.replace(/  if \(!APP\._d5LiSkelDone\) \{\n    APP\._d5LiSkelDone = true;\n    el\.innerHTML = d5SkeletonCardsHtml\(2\);\n    setTimeout\(function\(\) \{ renderLandlordIntel\(\); \}, 200\);\n    return;\n  \}\n/, '');
html = html.replace(/  html \+= '<button type="button" class="green-btn" style="margin-top:12px" onclick="d5DemoExportDownload\(\)">Download demo export<\/button><\/div>';/, "  html += '</div>';");
html = html.replace(/  if \(!items\.length\) html \+= d5EmptyStateHtml\('No follow-ups yet'[^;]+;\n/, '');
html = html.replace(/    html \+= d5EmptyStateHtml\('No clients yet'[^;]+;\n/, '');
html = html.replace(/    if \(!noteVal\.trim\(\)\) html \+= d5EmptyStateHtml\('No notes yet'[^;]+;\n/, '');
html = html.replace(/    html \+= d5EmptyStateHtml\('No listings yet', 'Adjust filters[^;]+;\n/, '');
removeBlock('// SPRINT D5', '// SPRINT E2');
html = html.replace(/\nfunction d5GetMock[\s\S]*?\/\/ SPRINT E2/, '\n// SPRINT E2');
html = html.replace(/<div id="d5ToastWrap" class="d5-toast-wrap" aria-live="polite"><\/div>\n/, '');
html = html.replace(/var LS_BUILD = '[^']+'/, "var LS_BUILD = '" + BUILD + "'");
html = html.replace(/\/\/ v[\d.]+ Sprint E2[^\n]*\n/, '// v1.8.0 Sprint D4 — rate limiting, session timeout, error boundaries (+ E2 legal)\n');

writeFileSync(outPath, html, 'utf8');
console.log('D4-only build:', html.match(/LS_BUILD = '([^']+)'/)?.[1]);
console.log('e2:', html.includes('e2-tos-pg'), 'd4:', html.includes('d4TrackApiCall'), 'd5:', html.includes('d5ShowToast'));
