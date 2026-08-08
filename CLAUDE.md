# CLAUDE.md — MAIN RULES (Aug 8 2026, Daya-approved)

## 🔴🔴🔴 CARDINAL RULE: NEVER COPY / SYNC UAT → LIVE

1. UAT and LIVE are DIFFERENT. UAT = mock/test. LIVE = real, all working.
2. **NEVER sync or copy files from UAT** — no `cp`, no `rsync`, no branch merge, no folder copy, NO WAY.
3. **ALWAYS test only in UAT first.** After Daya approves → **READ the UAT changes** (diff) → **manually re-apply THOSE changes in LIVE** with direct edits. No copy.
4. **NEVER deploy without Daya explicitly saying ok/approve/deploy.**
5. WHY: UAT is a mock — copying UAT files to LIVE gave LIVE the same mock files and broke the real site.

## Workflow (MANDATORY)

```
Edit UAT (saubhagyajewellery-uat/) → deploy UAT (wrangler pages --branch uat)
→ Daya verifies UAT → Daya approves → READ UAT diff
→ MANUALLY apply the same edits in LIVE (saubhagyajewellery/) via direct edit
→ git commit + push LIVE → verify LIVE
```

## NEVER DO

- `cp` / `cp -r` / `rsync` UAT → LIVE
- Copy UAT commits/branches to LIVE
- `git push` to LIVE without Daya's explicit "ok"/"approve"/"deploy"
- `npm run build` (regenerates curated files — edit files directly)
- Edit LIVE directly without Daya approval (except when Daya says "do it")

## Communication

- Hinglish, aap/tumhara (never tu/tere)
- Report with evidence (facts, not assumptions)
- After UAT change: STOP, show, WAIT for approval
