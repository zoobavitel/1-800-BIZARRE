# Branch flow and CI/CD

## Branches

| Branch      | Purpose              | CI/CD behavior                    |
|------------|----------------------|------------------------------------|
| **playersheet** | Feature work         | — (merge into dev when ready)     |
| **dev**         | Integration / dev   | Full CI (test, build). No deploy.  |
| **pat**         | Non-prod / staging  | Full CI (test, build). No deploy.  |
| **main**        | Production          | Full CI + **deploy to GitHub Pages** |

(If you still use **master** as prod, the workflow treats it like **main** and deploys from it.)

## Flow

1. **Merge playersheet → dev**  
   Push or open a PR from `playersheet` into `dev`. Merge when ready.

2. **Test CI/CD on pat (non-prod)**  
   Merge `dev` → `pat` (or push to `pat`). CI runs (frontend + backend tests, build). No deploy; use this to verify the pipeline.

3. **Prod (main)**  
   When pat looks good, merge `pat` → `main` (or `dev` → `main`). CI runs and, on **main**, the workflow deploys the frontend build to GitHub Pages (https://zoobavitel.github.io/jojo-ttrpg-platform/).

## Making main = prod

- Use **main** as the single production branch.
- In GitHub: **Settings → Pages → Source**: deploy from branch **gh-pages** (the workflow updates `gh-pages` when you push to **main**).
- Optionally make **main** the default branch: **Settings → General → Default branch** → switch from `master` to `main` if desired.

## Local commands (summary)

```bash
# After merging playersheet into dev locally (or via PR)
git checkout dev
git pull origin dev
git merge playersheet
git push origin dev

# To test CI on pat
git checkout pat
git pull origin pat
git merge dev
git push origin pat

# To release to prod
git checkout main
git pull origin main
git merge pat   # or merge dev
git push origin main
```
