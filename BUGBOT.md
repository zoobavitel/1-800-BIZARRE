# Review Standards

Focus only on critical correctness issues:
- Data loss or corruption
- Crashes on normal code paths
- Auth or permission bypass
- Significant user-facing breakage in core flows
- Security vulnerabilities with concrete exploit paths

Ignore style, refactors, and minor UX nits.

## Scope Priority

Prioritize changed files and call chains under:
- `backend/src/characters/**`
- `frontend/src/pages/CharacterSheet.jsx`
- `frontend/src/pages/CampaignManagement.jsx`

When mechanics behavior changes, cross-check against:
- `docs/1(800)-Bizarre SRD.md`

## Required Evidence For Any Finding

Every finding must include:
1. Concrete trigger scenario
2. Root cause in code path (caller to callee where relevant)
3. User/system impact
4. Minimal safe fix direction

If a concrete trigger scenario cannot be shown, do not flag it as a bug.

## Testing Expectations

If changed files include backend API or core game logic (`backend/src/characters/**`) and no tests are updated under:
- `backend/src/characters/tests.py`
- `backend/src/characters/test_*.py`
- `frontend/src/**/*.test.*`

flag as missing regression coverage.

## Output Contract

If critical bug found:
- Report bug and impact
- Report root cause
- Report fix and validation

If no critical bug found:
- Return exactly: `No critical bugs found.`
