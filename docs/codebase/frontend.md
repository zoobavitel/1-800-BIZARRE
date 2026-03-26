# Frontend (`frontend/src/`)

React 18 SPA (Create React App: `react-scripts`). **Routing is hash-based** in [`index.js`](../../frontend/src/index.js) (`window.location.hash`), not React Router for the main shell — `react-router-dom` is a dependency but the app uses manual `routeStateFromHash` / `handlePageChange`.

**API:** All JSON calls go to the Django API under `/api/...` via [`config/apiConfig.js`](../../frontend/src/config/apiConfig.js) (base URL ends with `/api`). Token auth: `localStorage.authToken`.

**Build:** `homepage` in [frontend/package.json](../../frontend/package.json) targets GitHub Pages; production often needs user-set API URL (see apiConfig).

---

## Entry and shell

| File | Role |
|------|------|
| [`index.js`](../../frontend/src/index.js) | `ReactDOM.createRoot`, wraps app in `AuthProvider`, `ThemeProvider`, `ProtectedRoute`; defines `App` with hash routing, `AppBar`, `HamburgerMenu`, page switcher |
| [`styles/global.css`](../../frontend/src/styles/global.css) | Global styles |

**Hash routes (examples):**

| Hash | Page component | Notes |
|------|----------------|-------|
| `` (empty) | `Home` | Landing |
| `character` / `character/<id>` | `CharacterPage` | PC sheet; id optional for new |
| `npcs` / `npcs/<id>` | `CharacterPage` | GM NPC mode (`preferNpcMode`) |
| `campaigns` / `campaigns/<id>` | `CampaignManagement` | |
| `abilities` / `abilities-<filter>` | `AbilityBrowser` | |
| `character-options` | `CharacterOptionsPage` | |
| `search` | `SearchPage` | Full-width, no shared AppBar |
| `notifications`, `messages`, `account-settings`, `patch-notes`, `licenses` | Respective pages | |
| `rules` / `rules-<section>` | `RulesPage` | SRD markdown |
| `test` | `ResponsiveTest` | |

---

## Config

| File | Role |
|------|------|
| [`config/apiConfig.js`](../../frontend/src/config/apiConfig.js) | `getApiBaseUrl`, `requireApiBaseUrl`, `setApiBaseUrl` — `REACT_APP_API_URL` or localhost dev default; localStorage key `apiBaseUrl`; normalizes trailing `/api`; ngrok HTTPS helper |

---

## Services (root)

| File | Role |
|------|------|
| [`services/campaignService.js`](../../frontend/src/services/campaignService.js) | Axios GET `/campaigns/` with ngrok header |

Most HTTP traffic uses **`fetch`** in feature modules (character sheet, auth).

---

## Auth feature (`features/auth/`)

| Path | Role |
|------|------|
| [`context/AuthContext.js`](../../frontend/src/features/auth/context/AuthContext.js) | Login state, token, user |
| [`services/authService.js`](../../frontend/src/features/auth/services/authService.js) | `authAPI` — login, signup, profile; uses `requireApiBaseUrl` |
| [`components/LoginForm.jsx`](../../frontend/src/features/auth/components/LoginForm.jsx), [`SignupForm.jsx`](../../frontend/src/features/auth/components/SignupForm.jsx), [`AuthFormShared.jsx`](../../frontend/src/features/auth/components/AuthFormShared.jsx) | Forms |
| [`index.js`](../../frontend/src/features/auth/index.js) | Public exports |

---

## Character sheet feature (`features/character-sheet/`)

| Path | Role |
|------|------|
| [`services/api.js`](../../frontend/src/features/character-sheet/services/api.js) | Large `characterAPI` module: CRUD, rolls, reference data, playbook transforms, `resolveMediaUrl` |
| [`hooks/useCharacterSheet.js`](../../frontend/src/features/character-sheet/hooks/useCharacterSheet.js), [`useReferenceData.js`](../../frontend/src/features/character-sheet/hooks/useReferenceData.js) | Sheet state |
| [`utils/characterUtils.js`](../../frontend/src/features/character-sheet/utils/characterUtils.js) | Helpers |
| [`constants/srd.js`](../../frontend/src/features/character-sheet/constants/srd.js) | SRD constants for UI |
| [`index.js`](../../frontend/src/features/character-sheet/index.js) | Re-exports `characterAPI`, transforms |

---

## Other features

| Path | Role |
|------|------|
| [`features/theme/ThemeContext.jsx`](../../frontend/src/features/theme/ThemeContext.jsx) | Theme provider |
| [`features/search/`](../../frontend/src/features/search/) | Search hooks / UI |
| [`features/dice-rolling/`](../../frontend/src/features/dice-rolling/) | Dice UI hooks |

---

## Pages (`pages/`)

| File | Role |
|------|------|
| `Home.jsx` | Dashboard / navigation tiles |
| `CharacterPage.jsx` | PC or NPC sheet host |
| `CharacterSheet.jsx` | Sheet UI |
| `CampaignManagement.jsx` | Campaigns, sessions, GM tools |
| `AbilityBrowser.jsx` | Browse abilities |
| `CharacterOptionsPage.jsx` | Creation options |
| `SearchPage.jsx` | Global search |
| `RulesPage.jsx` | SRD markdown |
| `PatchNotesPage.jsx`, `LicensesPage.jsx` | Static content |
| `AccountSettingsPage.jsx`, `NotificationsPage.jsx`, `MessagesPage.jsx` | User shell |
| `NPCSheet.jsx` | NPC-specific if used |
| `ResponsiveTest.jsx` | Layout test |

---

## Components (`components/`)

| File | Role |
|------|------|
| `ProtectedRoute.jsx` | Auth gate for children |
| `HamburgerMenu.jsx` | Side nav |
| `UserMenu.jsx` | Settings popover |
| `FactionMode.jsx` | Faction UI |

---

## Data (`data/`)

| File | Role |
|------|------|
| `patchNotes.js` | Generated or hand-edited patch notes |
| `rulesNav.js` | Rules navigation structure |
| `data.js`, `index.js` | Shared data exports |

**Pregenerate:** `prestart` / `prebuild` run `scripts/generatePatchNotes.js` and `scripts/copySrd.js` in `frontend/`.

---

## Related

- [backend-app.md](backend-app.md) — CORS and `/api` prefix
- [backend-characters-views.md](backend-characters-views.md) — endpoint map
