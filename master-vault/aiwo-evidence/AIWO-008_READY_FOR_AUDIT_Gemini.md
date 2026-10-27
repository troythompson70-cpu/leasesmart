# READY_FOR_AUDIT — GEMINI (Independent Auditor)

- work_order_id: AIWO-008, AIWO-009
- status: READY_FOR_AUDIT / PENDING_AUDIT
- routed_by: Cursor (Builder) — routing only; no self-VERIFY
- routed_at: 2026-09-17T14:16:56Z
- routing_checkpoint: CP-AIWO008009-ROUTE-GEMINI-20260917_141656

## Owner

**GEMINI = Independent Auditor**

## Prerequisite evidence (already complete — do not rebuild)

| Step | Owner | Evidence |
|---|---|---|
| Implementation | Cursor | PR #22 MERGED → `main` squash `1012854fc21174f53b85552670a6959d41a88058` |
| Independent review | Claude | `AGENT EVIDENCE/AIWO-008-009_Claude_Review_20260917_133904.md` |
| FINAL checkpoint | Canonical | `AGENT EVIDENCE/AIWO-008-009_FINAL_CHECKPOINT_20260917_133904.md` |
| Jared / Cisco | HARD HOLD | No outbound communication |

## Gemini must return exactly one verdict

- `VERIFIED` → ChatGPT Governor closes AIWO-008/009 after required canonical evidence/readback
- `CORRECTIONS_REQUIRED` → ChatGPT Governor routes **only failed requirements** to Cursor

## Audit scope

1. Fetch and prove commit object on `origin/main`: `1012854fc21174f53b85552670a6959d41a88058`
2. Diff/review AIWO-008 Command Center: NEW REPLIES ack gate, company↔domain, email/conversation snapshot, mobile/dark
3. Diff/review AIWO-009 governor: VERIFIED dependency gate, lock-token spoof block, evidence sha256, ERR-ORCH-006/007
4. Confirm regression evidence / tests exist and are coherent with merged code
5. Write Gemini audit evidence to `10 AUDIT & ACTIVITY LOG/AGENT EVIDENCE/`
6. Read back your write

## Forbidden

- Do not restart Cursor implementation
- Do not restart Claude review
- Do not reply to Jared Millikan / Cisco
- Do not substitute chat status for canonical evidence
- Cursor must not self-VERIFY; only Gemini issues VERIFIED / CORRECTIONS_REQUIRED for this audit lane

## Parallel Copilot action

Ensure Gemini exists as Independent Auditor identity in Microsoft 365 queue/routing:

```
Cursor READY_FOR_REVIEW → Claude
Claude READY_FOR_AUDIT → Gemini
Gemini VERIFIED → ChatGPT Governor
Gemini CORRECTIONS_REQUIRED → ChatGPT Governor → Cursor
```

Do not wait for redesign before Gemini audits this packet.
