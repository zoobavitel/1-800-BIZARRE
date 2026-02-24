# Deploy to GitHub Pages

Same idea as the [react-gh-pages](https://github.com/gitname/react-gh-pages) tutorial: the **built app** lives on the **gh-pages** branch, and GitHub Pages must be set to serve **that branch**, not your default branch (which has the README).

---

## If the site shows the README instead of the app

Two things must be true:

1. The **gh-pages** branch has the build (index.html + static files).
2. GitHub **Pages** is set to deploy from **gh-pages**, not from main/master.

### Step 1: Check what’s on gh-pages

Open: **https://github.com/zoobavitel/jojo-ttrpg-platform/tree/gh-pages**

- **If you see `index.html`, `static/`, etc.**  
  The build is there. Go to Step 2 (fix Pages settings).

- **If you see README / source code, or the branch is missing**  
  Deploy the build first (from repo root):

  ```bash
  npm run deploy
  ```

  Then open the link again and confirm `index.html` and `static/` are on **gh-pages**.

### Step 2: Configure GitHub Pages (required)

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

## Authentication: "Password authentication is not supported"

GitHub no longer accepts account passwords for Git. Use one of these:

### Option A: Personal Access Token (HTTPS)

1. GitHub → **Settings** (your profile) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. **Generate new token (classic)**. Name it e.g. `jojo-deploy`. Enable scope **repo**.
3. Copy the token (you won’t see it again).
4. When you run `npm run deploy`, at the prompt:
   - **Username:** your GitHub username (e.g. `zoobavitel`).
   - **Password:** paste the **token**, not your account password.

To avoid typing it every time, use the Git credential helper or store the remote with the token (keep the token secret, don’t commit it):

```bash
# One-time: cache credentials in memory (e.g. 1 hour)
git config --global credential.helper 'cache --timeout=3600'
# Then run npm run deploy and enter username + token once
```

### Option B: SSH (no password prompt)

1. [Add an SSH key to your GitHub account](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account) if you haven’t.
2. Use the SSH remote for this repo:

```bash
git remote set-url origin git@github.com:zoobavitel/jojo-ttrpg-platform.git
```

Then `npm run deploy` will use SSH and your SSH key (no username/password).

---

## "A branch named 'gh-pages' already exists"

The deploy script includes `--force` so the existing `gh-pages` branch is overwritten. If you still see this error, ensure the root `package.json` has:

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

The **homepage** in the root `package.json` must match your Pages URL (e.g. `https://zoobavitel.github.io/jojo-ttrpg-platform`).
