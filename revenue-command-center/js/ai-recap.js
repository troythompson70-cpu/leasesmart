/**
 * On-demand, in-browser AI recap for a single opportunity.
 *
 * Design constraints (do NOT relax):
 *  - Self-contained + client-side. No server-side agent loop, no ai.extract
 *    pipeline, no apply-plan UI, no MCP, no persisted "magic columns".
 *  - `buildLocalRecap` is PURE and no-network: deterministic + unit-testable.
 *  - `runAiRecap` upgrades to a real model call ONLY when a non-empty key is
 *    supplied (same fetch approach as command-center.html). It NEVER throws to
 *    the UI, NEVER logs/persists keys, and falls back to the local demo recap
 *    on any error or missing key.
 */
import { STALE_MS } from './constants.js';
import { transmissionOf, hasIncomingAttention, leadIdOf } from './transmission.js';

/** @typedef {'claude'|'openai'|'gemini'} AiProvider */

/**
 * Human-friendly date (keeps the ISO if it cannot be parsed — never invents).
 * @param {string|undefined|null} iso
 */
function fmtWhen(iso) {
  if (!iso) return 'unknown time';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return String(iso);
  return new Date(t).toISOString().replace('T', ' ').replace(/:\d\d\.\d+Z$/, ' UTC');
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/**
 * PURE synthesis of a useful recap from opportunity fields. No network, no
 * randomness. Same input → same output.
 *
 * @param {object} opp
 * @param {number} [now]
 * @returns {{ recap: string, risk: string, nextStep: string, mode: 'demo' }}
 */
export function buildLocalRecap(opp, now = Date.now()) {
  if (!opp || typeof opp !== 'object') {
    return {
      recap: 'No opportunity data available to summarize.',
      risk: 'Cannot assess risk — missing record.',
      nextStep: 'Open the SharePoint SoT record to confirm this opportunity exists.',
      mode: 'demo',
    };
  }

  const company = firstNonEmpty(opp.company, opp.vendor, 'This opportunity');
  const tier = opp.tier ? `tier ${opp.tier}` : 'untiered';
  const status = firstNonEmpty(opp.status, 'UNKNOWN');
  const tx = transmissionOf(opp);

  /* ---- recap: status + latest transmission summary ---- */
  const recapParts = [`${company} is currently ${status} (${tier}).`];
  if (tx) {
    const dir =
      tx.direction === 'INCOMING'
        ? 'an incoming message'
        : tx.direction === 'OUTBOUND'
          ? 'an outbound message'
          : 'a message';
    const subject = firstNonEmpty(tx.subject, '(no subject)');
    const sender = firstNonEmpty(tx.sender, 'unknown sender');
    let line = `Latest transmission is ${dir} on ${fmtWhen(tx.at)} — "${subject}" from ${sender}.`;
    if (tx.preview) line += ` Preview: "${tx.preview}"`;
    recapParts.push(line);
  } else {
    recapParts.push('No transmission is on record yet.');
  }
  const notes = firstNonEmpty(opp.notes, opp.operator_notes);
  if (notes) recapParts.push(`Notes: ${notes}`);

  /* ---- risk: stale / incoming-unanswered / owner-action ---- */
  const risks = [];
  const statusUpper = status.toUpperCase();
  const ownerAction =
    opp.owner_action_required === true ||
    opp.owner_action_required === 'Yes' ||
    statusUpper === 'OWNER_ACTION' ||
    statusUpper === 'ACCOUNT_SETUP' ||
    statusUpper === 'BLOCKED';
  if (ownerAction) {
    const cat = firstNonEmpty(opp.owner_action_category, 'owner action');
    risks.push(`Owner action required (${cat}) — Troy must act before this can progress.`);
  }
  if (hasIncomingAttention(opp)) {
    risks.push('Incoming reply is awaiting a response — not yet cleared.');
  }
  const verifiedAt = opp.last_verified_at ? Date.parse(opp.last_verified_at) : NaN;
  if (Number.isFinite(verifiedAt) && now - verifiedAt > STALE_MS) {
    risks.push(`Record is stale — last verified ${fmtWhen(opp.last_verified_at)}.`);
  } else if (!Number.isFinite(verifiedAt)) {
    risks.push('Record has no verified timestamp — confirm against the SoT.');
  }
  const risk = risks.length ? risks.join(' ') : 'No blocking risks detected — synced and current.';

  /* ---- nextStep: echo / derive next_action ---- */
  let nextStep = firstNonEmpty(opp.next_action);
  if (!nextStep) {
    if (tx && tx.direction === 'INCOMING') {
      nextStep = `Reply to the latest incoming message for Lead ID ${leadIdOf(opp)}.`;
    } else if (ownerAction) {
      nextStep = 'Complete the outstanding owner action, then update status.';
    } else {
      nextStep = 'Review the thread and set the next action.';
    }
  }

  return {
    recap: recapParts.join(' '),
    risk,
    nextStep,
    mode: 'demo',
  };
}

/**
 * Select the provider to use from the supplied in-memory keys. Priority is
 * Claude → OpenAI → Gemini. Returns null when no key is present.
 * @param {{claude?:string, openai?:string, gemini?:string}} keys
 * @returns {{ provider: AiProvider, key: string } | null}
 */
function selectProvider(keys) {
  if (!keys || typeof keys !== 'object') return null;
  const claude = (keys.claude || '').trim();
  const openai = (keys.openai || '').trim();
  const gemini = (keys.gemini || '').trim();
  if (claude) return { provider: 'claude', key: claude };
  if (openai) return { provider: 'openai', key: openai };
  if (gemini) return { provider: 'gemini', key: gemini };
  return null;
}

/** Build the user prompt from opp fields (safe — no keys, no secrets). */
function buildPrompt(opp) {
  const local = buildLocalRecap(opp);
  const tx = transmissionOf(opp);
  const facts = [
    `Company: ${firstNonEmpty(opp.company, opp.vendor, 'Unknown')}`,
    `Tier: ${opp.tier ?? 'n/a'}`,
    `Status: ${firstNonEmpty(opp.status, 'UNKNOWN')}`,
    `Owner action required: ${opp.owner_action_required ? 'yes' : 'no'}`,
    `Incoming attention: ${hasIncomingAttention(opp) ? 'yes' : 'no'}`,
    `Latest transmission: ${
      tx
        ? `${tx.direction} on ${fmtWhen(tx.at)} — "${firstNonEmpty(tx.subject, '(no subject)')}" from ${firstNonEmpty(tx.sender, 'unknown')}; preview: ${firstNonEmpty(tx.preview, '(none)')}`
        : 'none on record'
    }`,
    `Notes: ${firstNonEmpty(opp.notes, opp.operator_notes, '(none)')}`,
    `Next action on file: ${firstNonEmpty(opp.next_action, '(none)')}`,
    `Last verified: ${firstNonEmpty(opp.last_verified_at, '(unknown)')}`,
  ].join('\n');
  return (
    'You are a concise sales-ops assistant for an MSP revenue dashboard. ' +
    'Summarize this single opportunity. Respond ONLY with minified JSON of the ' +
    'exact shape {"recap":"...","risk":"...","nextStep":"..."} — no markdown, ' +
    'no code fences, no extra keys.\n\nOPPORTUNITY FACTS:\n' +
    facts +
    '\n\nFallback reference (local synthesis):\n' +
    JSON.stringify({ recap: local.recap, risk: local.risk, nextStep: local.nextStep })
  );
}

/** Parse a model text response into recap/risk/nextStep, tolerating prose. */
function parseModelText(text, opp) {
  const local = buildLocalRecap(opp);
  if (!text || typeof text !== 'string') return local;
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return {
        recap: firstNonEmpty(parsed.recap, local.recap),
        risk: firstNonEmpty(parsed.risk, local.risk),
        nextStep: firstNonEmpty(parsed.nextStep, parsed.next_step, local.nextStep),
      };
    } catch {
      /* fall through to prose handling */
    }
  }
  // No JSON — use the prose as the recap, keep locally-derived risk/next step.
  return { recap: text.trim().slice(0, 800), risk: local.risk, nextStep: local.nextStep };
}

async function callClaude(key, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const j = await r.json();
  return (j.content && j.content[0] && j.content[0].text) || '';
}

async function callOpenAI(key, prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const j = await r.json();
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}

async function callGemini(key, prompt) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' +
    encodeURIComponent(key);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const j = await r.json();
  return (
    (j.candidates &&
      j.candidates[0] &&
      j.candidates[0].content &&
      j.candidates[0].content.parts &&
      j.candidates[0].content.parts[0] &&
      j.candidates[0].content.parts[0].text) ||
    ''
  );
}

/**
 * Async recap. When a non-empty key is provided, call the corresponding model
 * and return { ..., mode:'<provider>' }. On ANY error or no key, fall back to
 * the pure local recap with mode:'demo'. Never throws; never logs/persists keys.
 *
 * @param {object} opp
 * @param {{claude?:string, openai?:string, gemini?:string}} [keys]
 * @returns {Promise<{recap:string, risk:string, nextStep:string, mode:string}>}
 */
export async function runAiRecap(opp, keys) {
  const selected = selectProvider(keys);
  if (!selected) return buildLocalRecap(opp);

  const prompt = buildPrompt(opp);
  try {
    let text = '';
    const { provider } = selected;
    switch (provider) {
      case 'claude':
        text = await callClaude(selected.key, prompt);
        break;
      case 'openai':
        text = await callOpenAI(selected.key, prompt);
        break;
      case 'gemini':
        text = await callGemini(selected.key, prompt);
        break;
      default: {
        // Exhaustiveness guard — a new provider must be handled above.
        const _exhaustive = provider;
        return buildLocalRecap(opp);
      }
    }
    const parsed = parseModelText(text, opp);
    return { ...parsed, mode: provider };
  } catch {
    // Any network/parse error → safe local fallback. Do not surface keys.
    return buildLocalRecap(opp);
  }
}
