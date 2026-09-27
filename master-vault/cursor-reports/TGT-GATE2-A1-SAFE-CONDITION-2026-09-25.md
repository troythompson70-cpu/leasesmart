# Gate 2 A1 — SAFE mode condition save (Cursor resume)

**Date:** 2026-09-25  
**Flow:** `TGT-EmailFeed-IN` (`bafc73d1-854d-4543-b6a2-b3a2240988e7`)  
**Prior:** Claude A1 FAILED (designer RHS stuck on `"RUN"`). Cursor SoT now follows Claude Gate 1 PASS.  
**Status:** **BLOCKED on authenticated PA session** — surgical Option B package ready.

## Target definition (after save + reload)

Condition comparing System Mode Choice **Value**:

```json
"equals": [
  "@first(outputs('Get_items_2')?['body/value'])?['Mode']?['Value']",
  "SAFE"
]
```

Do **not** compare to the Mode object. Do **not** leave `"RUN"` as this A1 target RHS.

## Why Claude’s UI edit failed

New designer accepted typing in the value box visually, but Code view still showed `"RUN"`. Classic designer was read-only. Undo restored last saved canvas. Operator dropdown *did* commit (produced `not.equals` … `"RUN"`), proving the RHS **value** control is the broken surface — not Save itself.

## Surgical ways to commit SAFE (smallest first)

### Option A — Expression editor (not the plain text box)

1. Open Condition → right-hand side → **fx** / Enter custom value / Expression.  
2. Paste only: `SAFE` as a **string literal** in the expression pane (or `'SAFE'` per designer).  
3. Open **Code view** before Save — confirm `"SAFE"`.  
4. Save → close → reopen → Code view still `"SAFE"`.

### Option B — Export / patch / import (bypasses broken text box) — **PREFERRED for Cursor**

Repo script (dry-run safe):

```bash
# 1. In PA: Flow → … → Export package (.zip). Unzip.
# 2. Dry-run:
node scripts/gate2-a1-patch-safe-rhs.mjs /path/to/unzipped-package
# 3. Apply:
node scripts/gate2-a1-patch-safe-rhs.mjs /path/to/unzipped-package --write
# 4. Re-zip → Import as **update** of existing TGT-EmailFeed-IN (same name).
# 5. Reload Code view → confirm RHS "SAFE".
```

Script rules:

- Touches **only** `equals[Mode Value path, "RUN"]` → `"SAFE"`.  
- Refuses zero matches or >1 ambiguous matches.  
- Idempotent if already `"SAFE"`.  
- Does **not** rebuild under a new flow name (addendum rule).

Self-test on fixture: dry-run / write / already-safe / negative — all behaved as expected (see `/opt/cursor/artifacts/gate2-a1-patch-script-selftest.log` on the agent run).

### Option C — Troy session on desktop

Cursor cloud VM has **no** M365 password/session for `tgates@…`. Troy (or Claude with an already-signed desktop) runs Option A or B and pastes Code-view proof.

## Preconditions

- SharePoint Mode Choice column must include choice **SAFE** (in addition to RUN / PAUSE). If SAFE is missing, add it before testing.  
- Leave flow **On**. Do not turn off.  
- Do not change unrelated actions.  
- Do not set `ModeAtIngest` (checkpoint removed it from Gate 2).

## Acceptance for A1

1. Code view after reload shows RHS `"SAFE"`.  
2. Behavioral test must match Troy’s Gate 2 checkpoint (`TGT_CONTINUITY_CHECKPOINT_2026-09-25_GATE2_EXECUTE.md` — not found in OneDrive audit folder at Cursor resume time). Default probe subject: `GATE2-A1-SAFE`.  
3. After A1 proof, restore Mode / condition so production RUN path is healthy before A2.

Exact SAFE-stop vs SAFE-only-process semantics belong to the checkpoint; the **saved string must still be `"SAFE"`**.

## Cursor session results (2026-09-25)

| Attempt | Result |
|---|---|
| Computer-use → make.powerautomate.com | **Blocked** at Microsoft sign-in for `tgates@tgttechnologies.com` (no password/session on VM) |
| Flow save | **Not attempted** — no auth |
| Option B script | **Ready** — `scripts/gate2-a1-patch-safe-rhs.mjs` + fixture self-test PASS |
| Gate 1 | **Not re-diagnosed** — Claude Gate 1 PASS held as SoT pending Troy acceptance |

**Unblock:** authenticated PA designer session (or exported zip dropped into the agent workspace for Option B `--write` + Troy import).
