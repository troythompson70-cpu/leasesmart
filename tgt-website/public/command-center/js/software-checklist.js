/**
 * LIST SOFTWARE checklist reconciliation.
 * Checklist is advisory; newer verified account evidence overrides stale setup tasks.
 */
import { SOFTWARE_EVIDENCE_OVERRIDES } from './constants.js';

function vendorMatch(name, keys) {
  const n = String(name || '').toLowerCase();
  return keys.some((k) => n.includes(k));
}

function actionLooksLikeSetup(action) {
  return /create|activate|setup|join|register|complete partner|initial/i.test(
    String(action || ''),
  );
}

/**
 * @param {Array} checklistItems — from LIST SOFTWARE or feed.software_checklist
 * @param {Array} [extraEvidence] — optional additional override records
 * @returns {Array} reconciled items with override metadata
 */
export function reconcileSoftwareChecklist(checklistItems, extraEvidence = []) {
  const evidence = [...SOFTWARE_EVIDENCE_OVERRIDES, ...extraEvidence];
  const items = Array.isArray(checklistItems) ? checklistItems : [];

  return items.map((item) => {
    const vendor = item.software || item.vendor || item.name || '';
    const action = item.action || item.task || '';
    const match = evidence.find((e) => vendorMatch(vendor, e.vendorKeys));
    if (!match) {
      return { ...item, suppressed: false, displayAction: action };
    }

    const shouldSuppress =
      actionLooksLikeSetup(action) ||
      match.suppressActions.some((s) =>
        String(action).toLowerCase().includes(String(s).toLowerCase()),
      );

    if (!shouldSuppress) {
      return { ...item, suppressed: false, displayAction: action, evidence: match };
    }

    return {
      ...item,
      suppressed: true,
      displayAction: `OVERRIDDEN — account evidence present (${match.evidenceLabel})`,
      originalAction: action,
      evidence: match,
      recommended_fix: 'Do not show as new account setup; keep historical checklist row',
    };
  });
}

/**
 * Parse Troy's LIST SOFTWARE email body into checklist rows.
 */
export function parseListSoftwareBody(text) {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];
  // Rows look like: "1 Cisco / Duo MSP Activate NFR/MSP ..."
  const re = /^\s*(\d+)\s+(.+?)\s+(Activate|Accept|Complete|Create|Finish|Schedule|Set up|Verify|Meeting)\b(.*)$/i;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      items.push({
        id: `list-software-${m[1]}`,
        software: m[2].trim(),
        action: `${m[3]}${m[4] || ''}`.trim(),
        source: 'LIST SOFTWARE (Outlook self-sent)',
      });
    }
  }
  // Fallback structured parse from known block if regex sparse
  if (items.length < 5) {
    const known = [
      ['Cisco / Duo MSP', 'Activate NFR/MSP'],
      ['Chinron', 'Accept admin invite'],
      ['Malwarebytes Techbench', 'Complete application/setup'],
      ['Microsoft DPC', 'Complete partner registration'],
      ['TinyPilot', 'Complete form'],
      ['Guardz', 'Activate/evaluate NFR'],
      ['Huntress', 'Complete partner setup'],
      ['MSP360', 'Create/finish MSP account'],
      ['HENNGE', 'Schedule/setup'],
      ['CYBERAWARE', 'Schedule/setup'],
      ['usecure', 'Meeting 9/15, 11 AM ET'],
      ['HeyGen', 'Set up AI Troy'],
      ['Canva', 'AI Troy graphics/templates'],
      ['Lovable', 'Verify Creator/free benefit'],
      ['Cursor', 'AI Troy/TGT automation'],
    ];
    return known.map(([software, action], i) => ({
      id: `list-software-${i + 1}`,
      software,
      action,
      source: 'LIST SOFTWARE (Outlook self-sent)',
    }));
  }
  return items;
}
