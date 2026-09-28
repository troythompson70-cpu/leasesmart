/**
 * Executive Readout + lane guidance for TGT Revenue Command Center.
 * Outlook-backed priorities — no fabricated live email claims.
 */

export const LANES = Object.freeze({
  REVENUE: 'revenue',
  NFR_SOFTWARE_AI: 'nfr_software_ai',
  CONTRACTORS_FIELD: 'contractors_field',
});

export const LANE_BANNERS = Object.freeze({
  [LANES.REVENUE]: {
    id: LANES.REVENUE,
    title: 'Revenue / paid work',
    subtitle: 'Paying customers, COI blockers, and billable pipeline.',
  },
  [LANES.NFR_SOFTWARE_AI]: {
    id: LANES.NFR_SOFTWARE_AI,
    title: 'Free NFR, software, and AI benefits',
    subtitle: 'MSP NFR / partner tools — not cash revenue until converted.',
  },
  [LANES.CONTRACTORS_FIELD]: {
    id: LANES.CONTRACTORS_FIELD,
    title: 'Contractors and field-service work',
    subtitle: 'Staffing, field, and contractor opportunities.',
  },
});

const HARD_HOLD_RE = /\b(cisco|duo)\b/i;
const COI_RE = /\b(coi|insurance|optus)\b/i;
const LORVEN_RE = /\blorven\b/i;
const CHAMBER_RE = /\b(chamber|gnyc|greater new york)\b/i;
const NFR_RE = /\b(nfr|msp|huntress|malwarebytes|chinron|cursor|pc\s*matic|hennge|software|ai)\b/i;
const FIELD_RE = /\b(contractor|field.?service|staffing|ups|port authority)\b/i;

export function mapOpportunityLane(opp) {
  const blob = [
    opp?.company,
    opp?.vendor,
    opp?.opportunity,
    opp?.thread_subject,
    opp?.subject,
    opp?.lane,
    opp?.category,
    opp?.next_action,
    opp?.blocker,
  ]
    .map((v) => String(v || ''))
    .join(' ');

  if (COI_RE.test(blob) || FIELD_RE.test(blob) || /optus/i.test(blob)) {
    return LANES.CONTRACTORS_FIELD;
  }
  if (HARD_HOLD_RE.test(blob) || NFR_RE.test(blob)) {
    return LANES.NFR_SOFTWARE_AI;
  }
  if (String(opp?.lane || '').toLowerCase().includes('revenue')) {
    return LANES.REVENUE;
  }
  // Default paid-work / pipeline
  if (/OWNER_ACTION|PROPOSAL|QUALIFYING|CONTACT/i.test(String(opp?.status || ''))) {
    return LANES.REVENUE;
  }
  return LANES.NFR_SOFTWARE_AI;
}

export function buildActionGuidance(opp) {
  const lane = mapOpportunityLane(opp);
  const company = opp?.company || opp?.vendor || 'This record';
  const status = String(opp?.status || '').toUpperCase();
  const next = String(opp?.next_action || '').trim();
  const blocker = String(opp?.blocker || '').trim();
  const hardHold = HARD_HOLD_RE.test(
    [company, opp?.opportunity, next, blocker].join(' '),
  );

  let goal = 'Advance a clear next commercial or operational step.';
  let whatHappened = next
    ? `Latest recorded next action: ${next}`
    : `Status is ${status || 'unknown'} with no next-action text on the record.`;
  let yourNextMove = next || 'Open the record, confirm the Outlook thread, then decide Keep / Pass / Save.';
  let why = 'Command Center only shows durable SoT fields — confirm in Outlook before sending anything.';

  if (COI_RE.test([company, next, blocker].join(' '))) {
    goal = 'Clear the insurance / COI blocker so paid work can proceed.';
    whatHappened = blocker || next || 'COI / insurance readiness is blocking progress.';
    yourNextMove = 'Assemble or send the COI packet; do not stall on adjacent NFR work.';
    why = 'P0 revenue blocker — Optus explicitly requested W-9 + current COI.';
  } else if (hardHold) {
    goal = 'Protect Cisco / Duo MSP relationship — read-only hard hold.';
    whatHappened =
      next ||
      'Cisco / Duo MSP thread is under HARD HOLD — no outbound mail from automation.';
    yourNextMove =
      'Do not send. Keep Active as read-only wait, or open the verified Outlook thread for human review only.';
    why =
      'HARD HOLD / read-only wait — live replies to Jared / Cisco must not be auto-sent from RCC.';
  } else if (LORVEN_RE.test(company)) {
    goal = 'Evaluate Lorven Technologies as a career / income opportunity.';
    whatHappened = next || 'Lorven opportunity is present in the queue.';
    yourNextMove = 'Review fit, then Keep Active or Pass / Not a Fit with a short note.';
    why = 'P1 career/income track — separate from MSP NFR tooling.';
  } else if (CHAMBER_RE.test([company, next, opp?.opportunity].join(' '))) {
    goal = 'Decide whether Greater New York Chamber networking is worth time.';
    whatHappened = next || 'Chamber networking item needs a yes/no time decision.';
    yourNextMove = 'Accept a next networking step or Pass / Not a Fit.';
    why = 'P2 networking — optional, not a revenue blocker.';
  } else if (lane === LANES.NFR_SOFTWARE_AI) {
    goal = 'Complete or park free NFR / software / AI partner setup.';
    why = 'Lane: free NFR, software, and AI benefits — not cash revenue until converted.';
  } else if (lane === LANES.CONTRACTORS_FIELD) {
    goal = 'Qualify contractor / field-service work for billable delivery.';
    why = 'Lane: contractors and field-service work.';
  } else {
    why = 'Lane: revenue / paid work.';
  }

  const actionLabels = hardHold
    ? {
        primary: 'Review (read-only)',
        contact: 'Open verified thread',
        followup: 'Draft only (no send)',
      }
    : {
        primary: status === 'OWNER_ACTION' ? 'Handle now' : 'Open plan',
        contact: 'Prepare outreach',
        followup: 'Prepare follow-up draft',
      };

  return {
    lane,
    laneBanner: LANE_BANNERS[lane],
    hardHold,
    goal,
    whatHappened,
    yourNextMove,
    why,
    nextActionPlan: [
      yourNextMove,
      hardHold
        ? 'HARD HOLD: no live send from RCC.'
        : 'If emailing, prepare a draft only until Graph write auth exists.',
      'Use Keep Active / Pass / Save / Delete-soft-remove for queue decisions.',
    ],
    actionLabels,
  };
}

/**
 * Static Executive Readout rows (Outlook-backed priorities from handoff).
 * Matching live opps deepen the "Your next move" when present in feed.
 */
export function buildExecutiveReadout(opportunities = []) {
  const opps = Array.isArray(opportunities) ? opportunities : [];
  const find = (re) =>
    opps.find((o) =>
      re.test(
        [o.company, o.vendor, o.opportunity, o.next_action, o.blocker]
          .map((x) => String(x || ''))
          .join(' '),
      ),
    );

  const coi = find(COI_RE);
  const cisco = find(HARD_HOLD_RE);
  const lorven = find(LORVEN_RE);
  const chamber = find(CHAMBER_RE);

  return [
    {
      priority: 'P0',
      id: 'exec-coi',
      title: 'NEXT Insurance / COI blocker',
      body: 'Clear W-9 + current COI for Optus / paid work. This is the top revenue blocker.',
      hardHold: false,
      matchedOpportunityId: coi ? coi.opportunity_id || coi.id : null,
      nextMove: coi?.next_action || 'Complete COI / insurance readiness packet.',
    },
    {
      priority: 'P1',
      id: 'exec-cisco-duo',
      title: 'Cisco Duo MSP — HARD HOLD / read-only wait',
      body: 'Do not send live email from RCC. Human review of verified Outlook thread only.',
      hardHold: true,
      matchedOpportunityId: cisco ? cisco.opportunity_id || cisco.id : null,
      nextMove: 'Keep Active as read-only wait. No outbound automation.',
    },
    {
      priority: 'P1',
      id: 'exec-lorven',
      title: 'Lorven Technologies — career / income opportunity',
      body: 'Evaluate fit as income track; Keep or Pass deliberately.',
      hardHold: false,
      matchedOpportunityId: lorven ? lorven.opportunity_id || lorven.id : null,
      nextMove: lorven?.next_action || 'Review Lorven opportunity and decide Keep / Pass.',
    },
    {
      priority: 'P2',
      id: 'exec-chamber',
      title: 'Greater New York Chamber — networking decision',
      body: 'Optional networking time decision — not a revenue blocker.',
      hardHold: false,
      matchedOpportunityId: chamber ? chamber.opportunity_id || chamber.id : null,
      nextMove: chamber?.next_action || 'Accept a networking step or Pass / Not a Fit.',
    },
  ];
}
