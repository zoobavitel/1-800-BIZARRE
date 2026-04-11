# Security & Privacy Policy

## No PII in this repository

This repository is public. **Never commit personally identifiable information (PII) or secrets**, including but not limited to:

| Category | Examples |
|---|---|
| Real names / handles | usernames, first/last names tied to real people |
| Credentials | passwords (plain or hashed), API keys, auth tokens |
| Contact info | email addresses, phone numbers |
| Session artefacts | interaction summaries, AI-chat logs that reference real users |

## What to do instead

### Test fixtures & management commands
- Use clearly fictional usernames (`test_gm`, `test_player`, `jack_rice_player`).
- Never hard-code passwords; use `User.objects.make_random_password()` or Django's `set_unusable_password()`.
- Replace any real hashed password in fixtures with the placeholder string:
  ```
  pbkdf2_sha256$1000000$xxxxxxxxxxxxxxxxxxxxxxxx$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- Do **not** store auth tokens (DRF `Token` objects) in fixtures or docs.

### User-binding / player-specific scripts
Scripts that bind a specific player's account to a character are local operational tools.  
Add them to `.gitignore` and **never push them** to the repository.

### Session / interaction logs
AI chat logs and similar session summaries often capture real usernames and tokens.  
These belong in `.gitignore` and must not be committed.

## Automated enforcement

Every push and pull request is scanned by **Gitleaks** (see `.github/workflows/secret-scan.yml` and `.gitleaks.toml`).  
The scan will fail and block the merge if a secret or PII pattern is detected.

If you believe a finding is a false positive, add an inline `gitleaks:allow` comment or update `.gitleaks.toml`.

## Reporting a security issue

If you discover that real credentials or PII were previously committed, please:
1. Open a **private** GitHub Security Advisory (or email the repository owner directly).
2. Rotate / invalidate any exposed credentials immediately.
3. Follow up with a PR that removes the data and updates `.gitignore` as needed.
