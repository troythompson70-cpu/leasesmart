# Pipeline Reconciliation — Outlook vs Command Center (2026-09-28)

**Rule:** Reconcile before create. Dedupe by company + domain + thread + source_message_id. No duplicate intros.

| company | domain | source_message_id (Graph id suffix / note) | thread / subject | received UTC | direction | CC opportunity_id known? | action |
|---|---|---|---|---|---|---|---|
| Action1 | action1.com | AAMk…AAVspwSFAAA= | Weekly Update Summary by Action1 | 2026-09-28T11:06:58Z | IN | unknown live | CLAIM→reconcile only; do not create duplicate |
| Chinron | chinron.io | AAMk…AAVr-KcwAAA= | RE: MSP NFR / Partnership Inquiry (Neville) | 2026-09-27T09:01:00Z | IN | fixture Chinron checklist only | CLAIM→password reset is owner MFA; no auto reply |
| Chinron | chinron.io | AAMk…AAVr-KcvAAA= | Reset Your Password | 2026-09-27T08:55:54Z | IN | — | Exception Queue owner (password); do not store secrets |
| NinjaOne | ninjaone.com | AAMk…AAVpyYB1AAA= | Re: Troy \| NinjaOne Overview — Mon Sep 28 10:00 AM ET | 2026-09-26T18:11:21Z | IN | unknown live | Meeting invite NOT on calendar — Troy accept/reschedule |
| Cisco/Duo | cisco.com | AAMk…AAVopXstAAA= | Jared: Duo account ready | 2026-09-23T20:47:15Z | IN | fixture SW-DUO-CISCO | HARD HOLD: do not reply to Jared without Troy |
| Cisco MSP | msp@cisco.com | ticket 2179189 thread | Confirm NFR + Managed-Customer Deployment Rights | 2026-09-22… | IN | SW-DUO-CISCO | Reconcile to existing; no new opp |
| Acronis | acronis.com | AAMk…AAVopXsYAAA= | Marco Calle outreach | 2026-09-23T16:59:27Z | IN | unknown | CLAIM→create only if no existing Acronis opp after CC readback |
| TinyPilot | gmail (Eric Friesner) | calendar event | Eric Friesner and Troy Thompson | 2026-09-29T14:00:00Z | CAL | none | Ensure pipeline row before meeting; no duplicate intro |
| Optus | — | — | not in top live hits | — | — | fixture opp-optus-coi | Keep; no create |
| PC Matic | — | — | not in top live hits | — | — | fixture SW-016 | Keep; no create |
| 24LiveIT / Concert / Norvet | — | — | not in top live hits this sweep | — | — | unknown | Search deeper before create |
| NYC SBS M/WBE | sbs.nyc.gov | AAMk…AAVpyYBfAAA= | Mentor Marcos Merced / QnA Tech — Wed Oct 7 11am–12pm | 2026-09-26T11:00:59Z | IN | none | Calendar/pipeline after Troy GO; no auto RSVP |
| NYS ESD MWBE | newnycontracts.com | AAMk…AAVpyYBdAAA= | Opportunity Showcase — Resorts World NYC Expansion | 2026-09-26T09:21:29Z | IN | none | Reconcile before create; marketing blast — triage only |
| NYS MWBE Forum | newnycontracts.com | AAMk…AAVopXreAAA= | 2026 NYS MWBE Forum — Tue Nov 17 Albany | 2026-09-22T21:41:48Z | IN | none | Note for Troy; do not auto-register |

**Status:** Reconciliation map written. Canonical SharePoint/CC write deferred until live CC readback path exists (apex APIs 404; Graph secrets absent in this env). No duplicate introductions sent.
