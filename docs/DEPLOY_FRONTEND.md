# Deploy the frontend

Players open **https://1-800-bizarre.com**. Cloudflare serves the built React app
as static files (Workers static assets). The API stays on
**https://api.1-800-bizarre.com** (Cloudflare Tunnel → Caddy → gunicorn on CT 103,
see [deploy/bizarre-api/README.md](../deploy/bizarre-api/README.md)).

## How a deploy happens

Every push to `master` runs the `deploy-frontend` job in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) after the UI smoke passes:

1. `npm ci && npm run build` with `REACT_APP_API_URL` from repo secrets
   (`https://api.1-800-bizarre.com/api`).
2. `cd deploy/frontend-cf && npm ci && npx cf deploy` uploads `frontend/build`.

Unlike `deploy-lxc`, this job is automatic and does not touch CT 103. A frontend
deploy during a game session changes the UI for players on their next page load.

The Cloudflare config lives in [`deploy/frontend-cf/`](../deploy/frontend-cf/):

- `cloudflare.config.ts`: Worker `bizarre-frontend`, custom domain
  `1-800-bizarre.com`, no `workers.dev` URL.
- `wrangler.config.ts`: assets directory `../../frontend/build`.

It has its own `package.json` so the `cf` and `wrangler` packages stay out of the
root `npm ci` that every CI job runs.

## Repo secrets

| Secret | Value |
|--------|-------|
| `REACT_APP_API_URL` | `https://api.1-800-bizarre.com/api` |
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts: Edit** (account) and **Workers Routes: Edit** + **DNS: Edit** (zone `1-800-bizarre.com`) |
| `CLOUDFLARE_ACCOUNT_ID` | The account that owns the `1-800-bizarre.com` zone |

## Deploy by hand

From the repo root, signed in with `cf auth login`:

```bash
npm run build
cd deploy/frontend-cf
npm ci
npx cf deploy
```

## API host and CORS

The build bakes the API host. If a build has none, `apiConfig.js` falls back to
`https://api.1-800-bizarre.com/api` on the `1-800-bizarre.com` host.

`prod.env` must list `https://1-800-bizarre.com` in both `CORS_ALLOWED_ORIGINS` and
`CSRF_TRUSTED_ORIGINS`.

A saved Game server URL overrides the baked host. Clear the field if sign-in
reaches the wrong server. Login is stored per site address, so moving from the
old GitHub Pages address needs one fresh login.

## Retired: GitHub Pages

The app used to live at `https://zoobavitel.github.io/1-800-BIZARRE/`. To finish
retiring it: GitHub repo **Settings → Pages → Unpublish site**, delete the
`gh-pages` branch, then drop `https://zoobavitel.github.io` from `prod.env` CORS
and CSRF origins.

## Rollback

- Bad build: Cloudflare dashboard → Workers → `bizarre-frontend` →
  Deployments → roll back to the previous version. Or `npx cf deploy` from an
  older commit.
