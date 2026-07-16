# 1-800-BIZARRE

A hobby TTRPG project by friends, inspired by Blades in the Dark-style campaign play.

This web app helps us run sessions and keep everything in one place:

- Character creation and persistent character storage
- Campaign, faction, and NPC tracking
- XP/progression management
- Rules, abilities, and reference data
- Session notes and shared campaign state
- Live in-page updates for active sessions

## Local run

```bash
npm ci
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
npm run dev
```

## CI/CD + deploy (quick)

- PRs trigger GitHub Actions CI (frontend, backend, integration tests)
- CI source of truth: Node 24 + Python 3.11
- Frontend can deploy to GitHub Pages after passing checks
- Set `REACT_APP_API_URL` for deploy builds

See:
- [docs/development.md](docs/development.md)
- [.github/README.md](.github/README.md)
