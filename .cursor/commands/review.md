Review the current branch changes with a high-severity bug-finding mindset.

Focus only on issues that can cause:
- data loss or corruption
- crashes on normal paths
- auth/permission bypass
- security vulnerabilities
- major user-facing breakage

Ignore style, low-severity UX, and theoretical concerns without a concrete trigger.

Investigation requirements:
- Trace full caller/callee path for changed code.
- Compare behavior with similar patterns elsewhere in this repo.
- Prioritize `backend/src/characters/**`, `frontend/src/pages/CharacterSheet.jsx`, and `frontend/src/pages/CampaignManagement.jsx`.
- If mechanics logic changed (rolls/sessions/XP/stress/assist/group actions/position/effect/advancement), cross-check with `docs/1(800)-Bizarre SRD.md`.

Confidence bar:
- Only report findings with a plausible concrete trigger scenario.
- If no concrete trigger exists, do not report it as a bug.

Output format:
1. Findings first, ordered by severity.
2. For each finding: trigger scenario, root cause, impact, minimal fix.
3. Missing tests section (only if behavior changed without coverage).
4. If no critical issues: `No critical bugs found.`
