# Frontend (`frontend/src/`)

React 18 SPA ([Create React App](https://create-react-app.dev/): `react-scripts`). **Routing is hash-based** in [`index.js`](../../frontend/src/index.js) (`window.location.hash` → `routeStateFromHash` / `handlePageChange`). `react-router-dom` is in `package.json` but **not used** in `src/`.

**API:** JSON to Django under `/api/...` via [`config/apiConfig.js`](../../frontend/src/config/apiConfig.js) (base URL ends with `/api`). Token: `localStorage.authToken`. Most calls use **`fetch`** in `features/character-sheet/services/api.js` and `features/auth/services/authService.js`.

**Build:** [`frontend/package.json`](../../frontend/package.json) `homepage` targets GitHub Pages; production often needs a user-set API URL (see apiConfig). `prestart` / `prebuild` run `scripts/generatePatchNotes.js` and `scripts/copySrd.js`.

**Quick entry:** [`frontend/src/README.md`](../../frontend/src/README.md) — short orientation; this file is the full map.

---

## Rules & SRD (authoritative sources)

Game mechanics in the UI must align with the text SRD. When changing dice, position/effect, XP, stress, rolls, or advancement UI, read these first:

| Source | Role |
|--------|------|
| [`docs/1-(800)-BIZARRE SRD.md`](../1-\(800\)-BIZARRE%20SRD.md) | **Canonical** rules text |
| [`docs/GAME_RULES.md`](../GAME_RULES.md) | Scannable dev/table reference |
| [`docs/SRD_INTEGRATION.md`](../SRD_INTEGRATION.md) | Fixtures, backend validation, tests |
| [`public/srd/`](../../frontend/public/srd/) | Per-section markdown for **Rules** page (generated from the SRD by `scripts/copySrd.js`) |

### Where the frontend encodes SRD mechanics

| Area | Code | SRD topics |
|------|------|------------|
| Sheet constants | [`features/character-sheet/constants/srd.js`](../../frontend/src/features/character-sheet/constants/srd.js) | Grades, 12 skills, creation dot caps, Stand coin budget, vice, resistance tooltips |
| XP / advancement | [`utils/xpRequirements.js`](../../frontend/src/features/character-sheet/utils/xpRequirements.js), [`utils/playbookXpTriggerSrd.js`](../../frontend/src/features/character-sheet/utils/playbookXpTriggerSrd.js) | End-of-session XP, playbook triggers |
| Position & effect | [`utils/rollEffectPreview.js`](../../frontend/src/features/character-sheet/utils/rollEffectPreview.js) (`normalizeEffectTier`), [`utils/sessionPositionEffectDefaults.js`](../../frontend/src/features/character-sheet/utils/sessionPositionEffectDefaults.js), [`components/position-effect/`](../../frontend/src/components/position-effect/) | **limited / standard / extreme** tiers; legacy `greater` → `extreme` in UI only |
| Ability roll bonuses | [`utils/abilityRollBonusMeta.js`](../../frontend/src/features/character-sheet/utils/abilityRollBonusMeta.js), [`utils/heritageRollBonusMeta.js`](../../frontend/src/features/character-sheet/utils/heritageRollBonusMeta.js) | Curated +1d / +1 effect; names match backend fixtures — see [standard-ability-roll-bonus-audit.md](standard-ability-roll-bonus-audit.md) |
| Rules browser | [`pages/RulesPage.jsx`](../../frontend/src/pages/RulesPage.jsx), [`data/rulesNav.js`](../../frontend/src/data/rulesNav.js) | Renders `public/srd/` sections |
| Live session sync | [`services/campaignEvents.js`](../../frontend/src/features/character-sheet/services/campaignEvents.js) | SSE for campaign/session updates (position/effect, rolls) |

Backend enforcement and `srd_*.json` fixtures: [backend-characters-core.md](backend-characters-core.md). REST map: [backend-characters-views.md](backend-characters-views.md).

---

## Entry and shell

| File | Role |
|------|------|
| [`index.js`](../../frontend/src/index.js) | `ReactDOM.createRoot`; `AuthProvider` → `ThemeProvider` → `App` wrapped in `ProtectedRoute`; `PAGE_TITLES`, hash router, `AppBar`, `HamburgerMenu`, page switcher |
| [`styles/global.css`](../../frontend/src/styles/global.css) | HFTF theme tokens and global base styles |

### Hash routes (mounted from `index.js`)

| Hash | Component | Notes |
|------|-----------|--------|
| *(empty)* | `Home` | Own header; shared `AppBar` hidden |
| `character` / `character/<id>` | `CharacterPage` | PC sheet; id optional for new |
| `npcs`, `npcs/<id>`, `npcs/new/<campaignId>` | `CharacterPage` | `preferNpcMode` |
| `campaigns`, `campaigns/<id>`, `campaigns/<id>/session/<sessionId>` | `CampaignManagement` | |
| `abilities`, `abilities-<filter>` | `AbilityBrowser` | |
| `character-options` | `CharacterOptionsPage` | |
| `search` | `SearchPage` | Own chrome (no shared `AppBar`) |
| `notifications`, `messages`, `account-settings`, `patch-notes`, `licenses` | Matching `pages/*` | |
| `rules`, `rules-<section>` | `RulesPage` | SRD markdown from `public/srd/` |
| `test` | `ResponsiveTest` | Layout smoke |

[`CharacterPage.jsx`](../../frontend/src/pages/CharacterPage.jsx) orchestrates API/state and renders [`CharacterSheet.jsx`](../../frontend/src/pages/CharacterSheet.jsx) or [`NPCSheet.jsx`](../../frontend/src/pages/NPCSheet.jsx). Those sheet files are **not** hash-mounted directly.

**Navigation helpers:** [`utils/spaNavigation.js`](../../frontend/src/utils/spaNavigation.js) — `buildRouteHash`, `buildRouteHref`, `handleSpaNavClick`.

---

## Config

| File | Role |
|------|------|
| [`config/apiConfig.js`](../../frontend/src/config/apiConfig.js) | `getApiBaseUrl`, `requireApiBaseUrl`, `setApiBaseUrl` — `REACT_APP_API_URL`, localStorage `apiBaseUrl`, trailing `/api`, ngrok HTTPS helper |

---

## Directory map

| Path | Role |
|------|------|
| [`pages/`](../../frontend/src/pages/) | Route targets and large UIs |
| [`features/`](../../frontend/src/features/) | Domain logic (layout varies per feature) |
| [`components/`](../../frontend/src/components/) | Shell + shared UI (`home/`, `session/`, `position-effect/`) |
| [`services/`](../../frontend/src/services/) | Legacy/orphan helpers only — see note below |
| [`config/`](../../frontend/src/config/) | Runtime config |
| [`data/`](../../frontend/src/data/) | `patchNotes.js`, `rulesNav.js`, shared exports |
| [`utils/`](../../frontend/src/utils/) | `spaNavigation`, chart helpers, API error text |
| [`styles/`](../../frontend/src/styles/) | Global + shared CSS |
| [`integration/`](../../frontend/src/integration/) | Backend integration tests (`npm run test:integration:frontend` from repo root, `RUN_BACKEND_INTEGRATION=1`) |

**Styling:** CSS variables in `styles/global.css` plus component/page CSS. Tailwind is configured under `frontend/` but is not the primary styling approach in `src/` today.

**Note:** [`services/campaignService.js`](../../frontend/src/services/campaignService.js) is unused (no imports); campaign HTTP lives on `campaignAPI` in [`features/character-sheet/services/api.js`](../../frontend/src/features/character-sheet/services/api.js).

---

## Features (`features/`)

### Auth (`features/auth/`)

| Path | Role |
|------|------|
| [`context/AuthContext.js`](../../frontend/src/features/auth/context/AuthContext.js) | Login state, token, user |
| [`services/authService.js`](../../frontend/src/features/auth/services/authService.js) | `authAPI` — login, signup, profile |
| [`components/LoginForm.jsx`](../../frontend/src/features/auth/components/LoginForm.jsx), [`SignupForm.jsx`](../../frontend/src/features/auth/components/SignupForm.jsx), [`AuthFormShared.jsx`](../../frontend/src/features/auth/components/AuthFormShared.jsx) | Forms |
| [`index.js`](../../frontend/src/features/auth/index.js) | Public exports |

### Character sheet (`features/character-sheet/`)

| Path | Role |
|------|------|
| [`services/api.js`](../../frontend/src/features/character-sheet/services/api.js) | `characterAPI`, `campaignAPI`, `npcAPI`, `crewAPI`, `referenceAPI`; CRUD, rolls, reference data, transforms, `resolveMediaUrl` |
| [`services/campaignEvents.js`](../../frontend/src/features/character-sheet/services/campaignEvents.js) | Campaign SSE subscription |
| [`hooks/useCharacterSheet.js`](../../frontend/src/features/character-sheet/hooks/useCharacterSheet.js), [`useReferenceData.js`](../../frontend/src/features/character-sheet/hooks/useReferenceData.js) | Sheet state |
| [`constants/srd.js`](../../frontend/src/features/character-sheet/constants/srd.js) | SRD-aligned UI constants |
| [`utils/`](../../frontend/src/features/character-sheet/utils/) | Roll outcome, dice pool, XP, position/effect defaults, ability/heritage bonus metadata |
| [`index.js`](../../frontend/src/features/character-sheet/index.js) | Re-exports `characterAPI`, transforms, hooks |

### Campaign management (`features/campaign-management/`)

| Path | Role |
|------|------|
| [`SessionXpAllocationTable.jsx`](../../frontend/src/features/campaign-management/SessionXpAllocationTable.jsx) | End-of-session XP allocation UI |
| [`sessionEndLiveXpPreview.js`](../../frontend/src/features/campaign-management/sessionEndLiveXpPreview.js) | XP cap / preview math (used by `CampaignManagement.jsx`) |

### Other features

| Path | Role |
|------|------|
| [`features/theme/ThemeContext.jsx`](../../frontend/src/features/theme/ThemeContext.jsx) | Theme provider |
| [`features/search/`](../../frontend/src/features/search/) | `useSearch` |
| [`features/dice-rolling/`](../../frontend/src/features/dice-rolling/) | `useDiceRolling` |

---

## Pages (`pages/`)

| File | Role |
|------|------|
| `Home.jsx` | Dashboard / navigation |
| `CharacterPage.jsx` | PC/NPC sheet host (tabs, API, mode switch) |
| `CharacterSheet.jsx` | PC sheet UI (large) |
| `NPCSheet.jsx` | NPC sheet UI (rendered from `CharacterPage` in NPC mode) |
| `CampaignManagement.jsx` | Campaigns, sessions, GM tools |
| `AbilityBrowser.jsx` | Browse abilities (standard / hamon / spin / heritage) |
| `CharacterOptionsPage.jsx` | Creation options |
| `SearchPage.jsx` | Global search |
| `RulesPage.jsx` | In-app SRD browser |
| `PatchNotesPage.jsx`, `LicensesPage.jsx` | Static content |
| `AccountSettingsPage.jsx`, `NotificationsPage.jsx`, `MessagesPage.jsx` | User shell |
| `ResponsiveTest.jsx` | Layout test (`#test`) |

---

## Components (`components/`)

| Path | Role |
|------|------|
| `ProtectedRoute.jsx` | Auth gate |
| `HamburgerMenu.jsx` | Side nav |
| `UserMenu.jsx` | Account popover |
| `FactionMode.jsx` | Faction UI |
| `home/` | Home dashboard charts and faction editor |
| `session/` | GM session panels (`SessionGMManagementPanels.jsx`, PE hints) |
| `position-effect/` | Position/effect indicators (SRD tier display) |

---

## Data (`data/`)

| File | Role |
|------|------|
| `patchNotes.js` | Generated by `scripts/generatePatchNotes.js` |
| `rulesNav.js` | Rules page navigation |
| `data.js`, `index.js` | Shared exports |

---

## Conventions (new work)

1. **Page route:** `PAGE_TITLES`, `routeStateFromHash`, `handlePageChange`, and the `currentPage` switch in `index.js`; links via `spaNavigation.js`.
2. **API:** `requireApiBaseUrl()`; prefer adding methods to `features/character-sheet/services/api.js` over new root `services/` files.
3. **Mechanics changes:** Cross-check [1-(800)-BIZARRE SRD.md](../1-\(800\)-BIZARRE%20SRD.md) and backend tests; update `constants/srd.js` or roll/XP utils when UI constants change.
4. **State:** Page-local `useState` default; shared state in feature contexts (`auth`, `theme`).

---

## Related

- [backend-app.md](backend-app.md) — CORS and `/api` prefix
- [backend-characters-views.md](backend-characters-views.md) — endpoint map
- [standard-ability-roll-bonus-audit.md](standard-ability-roll-bonus-audit.md) — ability roll checkbox rules
- [SRD_INTEGRATION.md](../SRD_INTEGRATION.md) — fixtures and validation overview
- Tests: `*.test.{js,jsx}` colocated; Playwright E2E in [`frontend/e2e/`](../../frontend/e2e/)
