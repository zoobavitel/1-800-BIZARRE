---
name: django-backend-ngrok
description: Starts the jojo-ttrpg-platform Django backend (venv activation and manage.py runserver on port 8000) and runs ngrok http 8000 so a remote or GitHub Pages frontend can reach the API; reports local and public URLs and reminds about CORS and ALLOWED_HOSTS when relevant. Use when the user says start backend, ngrok, tunnel, or remote API testing.
---

# Django backend + ngrok (jojo-ttrpg-platform)

## When to use

- User asks to start the API locally, expose it with ngrok, or test a remote frontend against this backend.

## Instructions

Use **two terminals** (or run Django in background, then ngrok in foreground). Do not assume the user already has ngrok or Django running.

### Prerequisites

- `ngrok` installed and authenticated (`ngrok config add-authtoken …` once per machine).
- Python venv with backend deps. This repo’s `scripts/start_dev.sh` uses `source ~/.virtualenvs/jojo/bin/activate`; if that path fails, use whatever venv the user normally uses for this project.

## Terminal 1 — Django

From the **repository root**:

```bash
cd backend/src
source ~/.virtualenvs/jojo/bin/activate   # or your venv
python manage.py runserver 0.0.0.0:8000
```

Default without `0.0.0.0` still binds for local use; `0.0.0.0` is fine if other devices on the LAN hit the machine directly.

**Local API base (report this):** `http://127.0.0.1:8000`  
Paths are under `/api/…` (see frontend `getApiBaseUrl()` normalization).

## Terminal 2 — ngrok

```bash
ngrok http 8000
```

**Public URL (report this):** copy the **HTTPS** forwarding URL from ngrok’s output (e.g. `https://xxxx.ngrok-free.app`). The frontend normalizes to `https` for ngrok hosts in `frontend/src/config/apiConfig.js`.

Remind the user: **ngrok URLs change** each session unless they use a paid reserved domain.

## Tell the user about the frontend

- **GitHub Pages / remote SPA:** set the game server URL in the app (login UI) or `localStorage` key used by `apiConfig.js` (`apiBaseUrl`) so the base becomes `https://<ngrok-host>/api` (trailing `/api` is applied automatically if omitted).
- The app already sends `ngrok-skip-browser-warning` for ngrok hosts in `api.js` and `authService.js`.

## CORS and ALLOWED_HOSTS (only if relevant)

Check `backend/src/app/settings.py` before suggesting edits.

| Symptom | Likely fix |
|--------|------------|
| `DisallowedHost` for the tunnel hostname | Add the host or a matching suffix to `ALLOWED_HOSTS`. Dev settings already include `.ngrok-free.app` and `.ngrok-free.dev`; custom / legacy ngrok domains may need an explicit entry. |
| Browser CORS error; `Origin` is your GitHub Pages site | Add that exact origin (scheme + host, port if any) to `CORS_ALLOWED_ORIGINS`. One Pages URL is already listed as an example—forks under other `*.github.io` paths need their origin added. |
| Quick local-only unblock (dev only) | Commented `CORS_ALLOW_ALL_ORIGINS = True` exists in settings; warn that it is insecure and not for production. |

If the user uses **production settings** (`settings_prod.py`) or env-driven overrides, apply the same concepts there instead of only `settings.py`.

## Summary to paste for the user

After both processes are up, give:

1. **Local:** `http://127.0.0.1:8000`
2. **Public (HTTPS):** the ngrok forwarding URL
3. **Frontend:** point API base at `https://<ngrok-host>/api` (via UI or stored URL)
4. **If errors:** CORS → `CORS_ALLOWED_ORIGINS`; `DisallowedHost` → `ALLOWED_HOSTS`
