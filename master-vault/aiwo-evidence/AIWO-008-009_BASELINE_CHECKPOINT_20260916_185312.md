# BASELINE_CHECKPOINT — AIWO-008 / AIWO-009 Corrections

- work_order_id: AIWO-008, AIWO-009
- agent: Cursor
- checkpoint_id: CP-AIWO008009-BASELINE-20260916_185312
- timestamp: 2026-09-16T18:53:12Z
- current_phase: CORRECTIONS_IN_PROGRESS
- last_completed_step: STEP_0_LOAD_MANDATORY_SOURCES
- current_step: STEP_1_REPOSITORY_TRUTH
- next_step: STEP_2_OUTLOOK_INGESTION_FIX
- files/components_touched: (none yet — baseline only)
- commands/tests_and_exit_codes: |
  - git fetch origin main => 0
  - git fetch origin --prune => 0
  - git rev-parse HEAD => 0 (0de6f53315f1d50a61af6e04d44f092c3d3deca1)
  - git ls-remote origin HEAD => 0 (matches local main)
  - git cat-file -t 9da31d0 => FAIL (invalid object; Claude rejection confirmed)
  - git cat-file -t 51c11c1 => not found (invalidated)
  - OneDrive download Claude review / AIWO-008 / AIWO-009 / queue / ledger => 0
- evidence_paths: |
  - /tmp/aiwo-docs/AIWO-008-009_Claude_Review_20260916_182500.md
  - /tmp/aiwo-docs/AIWO-008_COMMAND_CENTER_NEW_REPLIES_ACK_GATE.md
  - /tmp/aiwo-docs/AIWO-009_TRIPLE_REDUNDANCY_GOVERNOR_ENFORCEMENT.md
  - /tmp/aiwo-docs/TGT_AI_EXECUTION_QUEUE.csv
  - /tmp/aiwo-docs/TGT_ERROR_LESSONS_GUARDRAIL_LEDGER.csv
  - /tmp/aiwo-docs/TGT_MANDATORY_RESUMABLE_EXECUTION_PROGRESS_CHECKPOINT_RULE_v1.md
  - /tmp/aiwo-docs/AIWO-007_Claude_Review.md
  - OneDrive: 10 AUDIT & ACTIVITY LOG/AGENT EVIDENCE/AIWO-008-009_Claude_Review_20260916_182500.md
- blockers: |
  - Prior Cursor completion evidence INVALIDATED (unfetchable SHAs 9da31d0 / 51c11c1)
  - AIWO-008/009 implementation not present on any remote branch
  - Live Jared Millikan reply (cisco.com Duo MSP/NFR) not ingested into Command Center
  - AIWO-007 orchestrator fixes not landed (byte-identical to f3248e5)
- rollback_point: origin/cursor/rcc-orphan-discovery-repair-ec7a @ 9e25398666acf32cccb02cc1ddd2ec68634cdc49
- resume_instruction: |
  resume_from=CP-AIWO008009-BASELINE-20260916_185312
  Start STEP 1 complete recording, then branch cursor/aiwo-008-009-corrections-9aad from 9e25398.
  Implement AIWO-008 NEW REPLIES + email snapshot + company-domain + mobile/dark + AIWO-009 governor fixes.
  DO NOT reply to Jared Millikan. DO NOT reuse invalidated SHAs.
- heartbeat_at: 2026-09-16T18:53:12Z

## Explicit resume declarations

resume_from=CP-AIWO008009-BASELINE-20260916_185312

completed_work_not_to_repeat=<validated completed work>:
- AIWO-006 automation foundation code exists at tgt-orchestrator/ on branch cursor/aiwo-006-automation-foundation-ec7a (f3248e5 / d6faa91) — do not re-implement foundation; APPLY AIWO-007 required fixes only
- RCC orphan/discovery/NEW ACTIVITY modules exist at 9e25398 — do not redesign; repair/extend
- PR #19 / #20 / dashboard recovery UI code exists — do not redesign Command Center from scratch
- INVALIDATED: any claim tied to 9da31d0 / 51c11c1 / scripts/tgt_orchestrator.py / localhost:43147-only UI proof

## Repository truth (preliminary)

- canonical_remote: https://github.com/troythompson70-cpu/leasesmart
- active_branch_at_start: main @ 0de6f53315f1d50a61af6e04d44f092c3d3deca1 (matches origin/main)
- best_validated_rcc_tip: origin/cursor/rcc-orphan-discovery-repair-ec7a @ 9e25398
- AIWO-008/009 implementation on remote: NONE (Claude rejection confirmed)
