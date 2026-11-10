# frontend/public/

Static assets served as-is by Create React App / `react-scripts`. Files in this folder are copied verbatim into `frontend/build/` at production-build time and are referenced from `index.html` via `%PUBLIC_URL%/...`.

## Contents

| File / dir | Role |
|------------|------|
| `index.html` | CRA's HTML shell — the React app mounts into `<div id="root">`. |
| `favicon.ico`, `logo192.png`, `logo512.png` | Browser tab icon + PWA icons referenced by `manifest.json`. |
| `manifest.json` | PWA manifest (name, icons, theme). |
| `robots.txt` | Crawler directives. |
| `media/` | Static images used in-app (e.g. `1(800)Bizarre Character Sheet.png`). |
| `srd/` | Generated **at build time** by `scripts/copySrd.js` / `splitSrd.js` — the SRD markdown gets split into per-section files so `RulesPage` can fetch them. Do not hand-edit; edit [`docs/1-(800)-BIZARRE SRD.md`](../../docs/1-\(800\)-BIZARRE%20SRD.md) and re-run the build instead. |

## Conventions

- Put **hashed, processed assets** (anything imported from JSX/CSS) in [`src/assets/`](../src/assets/) instead. Use `public/` only for files you need at a stable URL or that must not be processed.
- The CRA `homepage` field in [`../package.json`](../package.json) determines the public path prefix for these assets (currently the GitHub Pages URL).
