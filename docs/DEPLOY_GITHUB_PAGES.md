# Deploy to GitHub Pages

Same idea as the [react-gh-pages](https://github.com/gitname/react-gh-pages) tutorial: the **built app** lives on the **gh-pages** branch, and GitHub Pages must be set to serve **that branch**, not your default branch (which has the README).

---

## If the site shows the README instead of the app

**Cause:** GitHub Pages is serving your **default branch** (main/master). That branch has no `index.html` at the repo root, so GitHub shows the README.

**Fix:** Serve from the **gh-pages** branch (which contains only the built app).

### Step 1: Deploy the build to gh-pages

From the **repo root**:

```bash
npm run deploy
```

- This runs `predeploy` → builds the frontend into `frontend/build`.
- Then pushes the **contents** of `frontend/build` to the **gh-pages** branch.

If you see auth errors, see [Authentication](#authentication-password-authentication-is-not-supported) below.

### Step 2: Confirm gh-pages has the app

Open: **https://github.com/zoobavitel/jojo-ttrpg-platform/tree/gh-pages**

You should see:

- `index.html`
- `static/` (with `js/`, `css/`)
- `favicon.ico`, `manifest.json`, etc.

If you see README / source code or the branch is missing, Step 1 didn’t work; fix auth and run `npm run deploy` again.

### Step 3: Set GitHub Pages to use gh-pages (required)

GitHub must serve the **gh-pages** branch, not the default branch:

1. Repo: **https://github.com/zoobavitel/jojo-ttrpg-platform**
2. **Settings** (tab at top).
3. Left sidebar → **Pages** (under “Code and automation”).
4. Under **“Build and deployment”** set:
   - **Source:** **Deploy from a branch**
   - **Branch:** **gh-pages** (not main/master)
   - **Folder:** **/ (root)**
5. Click **Save**.

Wait 1–2 minutes, then open **https://zoobavitel.github.io/jojo-ttrpg-platform/** — you should see the app.

---

## Checklist (Create React App deployment)

- [x] **homepage** in **frontend/package.json**: `"https://zoobavitel.github.io/jojo-ttrpg-platform"` (no trailing slash) — so the build uses correct asset paths.
- [x] **Root package.json**: `predeploy` and `deploy` scripts; `deploy` uses `gh-pages -d frontend/build`.
- [ ] **You ran** `npm run deploy` from repo root at least once.
- [ ] **GitHub Settings → Pages**: Source = “Deploy from a branch”, Branch = **gh-pages**, Folder = **/ (root)**.

---

## Authentication: "Password authentication is not supported"

GitHub no longer accepts account passwords for Git. Use one of these:

### Option A: Personal Access Token (HTTPS)

1. GitHub → **Settings** (your profile) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **Generate new token (classic)**. Name it e.g. `jojo-deploy`. Enable scope **repo**.
3. Copy the token (you won't see it again).
4. When you run `npm run deploy`, at the prompt:
   - **Username:** your GitHub username (e.g. `zoobavitel`).
   - **Password:** paste the **token**, not your account password.

To avoid typing it every time, use the Git credential helper or store the remote with the token (keep the token secret, don't commit it):

```bash
# One-time: cache credentials in memory (e.g. 1 hour)
git config --global credential.helper 'cache --timeout=3600'
# Then run npm run deploy and enter username + token once
```

### Option B: SSH (no password prompt)

1. [Add an SSH key to your GitHub account](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) if you haven't.
2. Use the SSH remote for this repo:

```bash
git remote set-url origin git@github.com:zoobavitel/jojo-ttrpg-platform.git
```

Then `npm run deploy` will use SSH and your SSH key (no username/password).

---

## "A branch named 'gh-pages' already exists"

The deploy script can be updated to overwrite the existing branch. In root `package.json`:

```json
"deploy": "gh-pages -d frontend/build --force"
```

Then run `npm run deploy` again.

---

## Deploy command (repo root)

```bash
npm run deploy
```

- Runs `predeploy` (builds the frontend into `frontend/build`).
- Pushes the **contents** of `frontend/build` to the **gh-pages** branch.

The **homepage** in **frontend/package.json** must match your Pages URL (e.g. `https://zoobavitel.github.io/jojo-ttrpg-platform`).
