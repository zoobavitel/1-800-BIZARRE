# Manual Release Signoff

Manual layer is top of pyramid. Run only for release readiness.

## Command

`npm run test:manual`

## Required Evidence

- Screenshot or terminal output for each check.
- Link evidence in release notes or PR comment.

## Checks

1. Auth flow: signup, login, logout.
2. Protected route blocks unauthenticated access.
3. Character create/edit persists after refresh.
4. Character delete removes row from listing.
5. GM starts session and sets defaults.
6. Player submits session-linked roll-action.
7. GM sees roll in history and can patch position/effect.
8. API latency budget check passes.
9. Lighthouse budget check passes.

## Fail Criteria

- Any failed check blocks deploy.
- Missing evidence counts as failed check.
