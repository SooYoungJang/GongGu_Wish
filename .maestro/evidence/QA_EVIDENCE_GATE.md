# QA Evidence Gate Process

> **Mandatory pre-approval checks** that QA **MUST** pass before marking any Maestro E2E evidence as APPROVED/PASS.
>
> These gates exist because Critic has rejected evidence **three times** for duplicate SHA256 screenshots caused by QA not running verification tools before approving.

---

## Gate 1: Git-Commit Gate (Dev Fix Must Be Committed)

**When:** Before QA re-runs Maestro tests after a Dev fix.

**Check:**
1. `cd /Users/pc/Documents/RN_GongGu_Wish`
2. `git status`
3. Verify that `.maestro/` directory changes **are committed** (not untracked/staged only)

**Pass condition:** `git status` shows "nothing to commit, working tree clean" for `.maestro/` changes.
**Fail action:** Do NOT re-run Maestro tests. Block and request that Dev commits the fix first.

**Rationale:** Without a git commit, there is no traceable record of which code state produced the evidence. Critic cannot verify that the fix was actually applied. The fix must be committed so that:
- The commit SHA is recorded in the evidence report
- Critic can verify the fix by checking out that commit
- The evidence is reproducible from a known code state

---

## Gate 2: SHA256 Verification Gate (Mandatory Pre-Approval)

**When:** After Maestro test completes and screenshots are captured, **before** marking APPROVED/PASS.

**Tool:** `scripts/verify-maestro-screenshot-hashes.sh`

**Steps:**
1. Run the verifier against each device screenshot directory:
   ```bash
   cd /Users/pc/Documents/RN_GongGu_Wish
   bash scripts/verify-maestro-screenshot-hashes.sh .maestro/evidence/375pt
   bash scripts/verify-maestro-screenshot-hashes.sh .maestro/evidence/390pt
   bash scripts/verify-maestro-screenshot-hashes.sh .maestro/evidence/414pt
   ```
2. For each directory, confirm the output shows `unique_sha256=N total_pngs=6` where **N must be 6**.
3. If N < 6 for any device class, screenshots contain duplicates → **FAIL** → Do NOT APPROVE.
4. Take a **screenshot of the terminal output** showing the script results for all 3 runs, and attach it as evidence.

**Pass condition:** All 3 device directories report `unique_sha256=6 total_pngs=6`.

**Fail action:**
- Do NOT mark PASS/APPROVE
- Report the duplicate hashes to Dev with `unique_sha256=N` values and the duplicate file names
- Request a new Dev fix to address the screenshot cache issue

**Verification script reference:**
```
Location: scripts/verify-maestro-screenshot-hashes.sh
Function: Computes SHA256 for all 6 PNGs in a directory and reports uniqueness count
Exit code: 0 (PASS — all unique), 1 (FAIL — duplicates found), 64 (usage), 65 (wrong file count), 66 (dir not found)
```

---

## Gate 3: Evidence Attestation (QA Sign-off)

After both Gate 1 and Gate 2 pass:

1. **Run** the SHA256 verifier for all 3 device directories **in sequence**.
2. **Capture** the terminal output (screenshot or copy-paste) showing the script results.
3. **Include** in the QA report:
   - The `unique_sha256=N total_pngs=6` line for each device class
   - The Dev commit SHA (`git log -1 --format="%H"`)
   - Confirmation that `.maestro/` changes are committed
4. **Only then** mark the QA evidence as APPROVED/PASS.

---

## Complete QA Workflow

```
┌─────────────────────────────────────────────────────┐
│ Dev Fix Submitted (task assigned to Dev)             │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ GATE 1: Git-Commit Check                             │
│ Is .maestro/ committed?                              │
│   YES → proceed                                      │
│   NO  → BLOCK: request Dev to commit                 │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ QA re-runs Maestro tests on 3 devices                │
│ (375pt, 390pt, 414pt)                                │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ GATE 2: SHA256 Verification                          │
│ Run verify-maestro-screenshot-hashes.sh on each dir  │
│ All 3 pass (unique_sha256=6)?                        │
│   YES → proceed                                       │
│   NO  → FAIL: report duplicates to Dev, do NOT APPROVE│
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ GATE 3: Evidence Attestation                         │
│ Document results + commit SHA in QA report           │
│ Attach verification terminal output                  │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ QA marks APPROVED/PASS ✓                             │
│ Evidence is ready for Critic review                  │
└─────────────────────────────────────────────────────┘
```

---

## Enforcement

- **QA** is responsible for running all three gates before APPROVE.
- **DevLead** reviews QA evidence submissions and enforces gate compliance during code review.
- **Critic** independently verifies SHA256 uniqueness. If duplicates are found again, the evidence is rejected and a process violation is recorded.
- **Process violation**: If evidence is submitted without passing Gate 2, the QA lead is notified and the evidence is rejected by default.

---

## Quick Reference (Cheat Sheet)

```bash
# Gate 1 — Check commit
cd /Users/pc/Documents/RN_GongGu_Wish
git status
# Expected: nothing to commit, working tree clean

# Gate 2 — Verify SHA256 uniqueness
bash scripts/verify-maestro-screenshot-hashes.sh .maestro/evidence/375pt
bash scripts/verify-maestro-screenshot-hashes.sh .maestro/evidence/390pt
bash scripts/verify-maestro-screenshot-hashes.sh .maestro/evidence/414pt
# Expected for each: unique_sha256=6 total_pngs=6

# Gate 3 — Record commit SHA
git log -1 --format="Commit SHA: %H%nAuthor: %an%nDate: %ad%nSubject: %s"
```

---

## History

| Date | Event |
|------|-------|
| 2026-06-21 | Critic t_e0ef15fe: 1st rejection — 390pt/414pt SHA256 duplicates found |
| 2026-06-21 | Critic t_bedc0e96: 2nd rejection — same duplicates after "fix" without git commit |
| 2026-06-21 | **This gate document created** — mandatory pre-approval process established |
