# Deploy to GitHub Pages

After running `npm run deploy`, the site will only show the app (not the README) if GitHub Pages is **serving from the `gh-pages` branch**.

## Fix: "I only see the README"

GitHub is currently serving from your **default branch** (e.g. `main`), which shows the repo root and README. Switch it to the branch that contains the built app:

1. Open your repo: **https://github.com/zoobavitel/jojo-ttrpg-platform**
2. Click **Settings** (repo tabs → Settings).
3. In the left sidebar, under **"Code and automation"**, click **Pages**.
4. Under **"Build and deployment"**:
   - **Source**: choose **"Deploy from a branch"** (not "GitHub Actions").
   - **Branch**: open the dropdown and select **`gh-pages`**.
   - **Folder**: leave as **`/ (root)`**.
5. Click **Save**.

Wait 1–2 minutes, then open **https://zoobavitel.github.io/jojo-ttrpg-platform/** — you should see the 1-800-BIZARRE app.

## Deploy commands

From the repo root:

```bash
npm run deploy
```

This builds the frontend and pushes the build to the `gh-pages` branch. The `homepage` in root `package.json` must match your Pages URL (e.g. `https://zoobavitel.github.io/jojo-ttrpg-platform`).
