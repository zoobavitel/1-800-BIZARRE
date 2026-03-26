# Characters app — core (`backend/src/characters/`)

Primary Django app: ORM models, DRF serializers, shared viewsets in `views.py`, parsers, admin, and service helpers. URL routing lives in [`app/urls.py`](../../backend/src/app/urls.py) (see [backend-app.md](backend-app.md)). Per-module API views are under `views/` (see [backend-characters-views.md](backend-characters-views.md)).

---

## [apps.py](../../backend/src/characters/apps.py)

Standard `AppConfig` with `name = 'characters'`.

---

## [models.py](../../backend/src/characters/models.py)

Single module defining the game and user data schema. Migrations live in `characters/migrations/` (not documented here).

**Campaign / social**

| Model | Role |
|-------|------|
| `Campaign` | GM, players M2M, `active_session`, scene type, wanted stars |
| `CampaignInvitation` | Pending/accepted invites to campaigns |
| `Faction` | Per-campaign factions (tier, hold, rep) |
| `UserProfile` | One-to-one with `User`: avatar, theme, notification prefs |

**Crew / Blades-style meta**

| Model | Role |
|-------|------|
| `Claim`, `CrewSpecialAbility`, `CrewPlaybook`, `CrewUpgrade` | Crew playbooks, claims, upgrades |
| `Crew` | Per-campaign crew: XP, rep, coin, name consensus fields, M2M claims/special abilities |

**Character options (reference data)**

| Model | Role |
|-------|------|
| `Heritage`, `Benefit`, `Detriment` | Heritage HP and pick lists |
| `Vice`, `Trauma` | Character vice and trauma catalogs |
| `Ability` | Generic abilities catalog |
| `Stand`, `StandAbility`, `HamonAbility`, `SpinAbility` | Playbook abilities |
| `CharacterHamonAbility`, `CharacterSpinAbility` | Join/picks for Hamon/Spin |

**PC / NPC**

| Model | Role |
|-------|------|
| `Character` | Large PC model: stats, harm, stress, Stand/Hamon/Spin fields, campaign/crew links |
| `NPC` | GM/creator-scoped NPCs, playbooks, clocks, armor |
| `ShowcasedNPC` | NPCs surfaced in session UI |

**Session / play**

| Model | Role |
|-------|------|
| `Session`, `SessionEvent` | Session records and event log |
| `SessionNPCInvolvement` | NPC visibility per session |
| `ExperienceTracker`, `XPHistory`, `StressHistory` | XP and stress tracking |
| `ProgressClock` | Shared clocks |
| `Roll`, `RollHistory` | Dice rolls and history |
| `ChatMessage` | In-app chat |
| `Score`, `DowntimeActivity` | Score/downtime structures |
| `FactionRelationship`, `CrewFactionRelationship` | Faction graph edges |
| `CharacterHistory` | Audit/history lines for characters |

---

## [serializers.py](../../backend/src/characters/serializers.py)

DRF `ModelSerializer` and a few `Serializer` classes for nested updates (user profile, passwords, session NPC involvement, character payloads). Aligns with ViewSets in `views.py` and `views/*.py`: exposes nested crew/playbook data, session votes, character JSON fields, image uploads, etc. Large file; new endpoints usually add or extend serializers here.

---

## [views.py](../../backend/src/characters/views.py)

**Role:** Large barrel file containing many `ModelViewSet` and function-based API views registered in [urls.py](../../backend/src/app/urls.py): auth (`LoginView`, `RegisterView`, `CurrentUserView`), reference data, rolls, chat, XP/stress history, crew/claim/playbook viewsets, etc.

**Note:** Some viewset classes are **duplicated** in the file (e.g. `ClaimViewSet` / `CrewPlaybookViewSet` blocks appear twice); Python uses the last definition. Prefer new work in `views/` package when possible. Detailed endpoint behavior: [backend-characters-views.md](backend-characters-views.md).

---

## [parsers.py](../../backend/src/characters/parsers.py)

**`MultipartJsonParser`:** Extends DRF `MultiPartParser` to `json.loads` string values that look like JSON objects/arrays so `JSONField` and nested payloads work with multipart file uploads (e.g. character sheet images + JSON stats).

---

## [admin.py](../../backend/src/characters/admin.py)

Registers `Heritage` (with benefit/detriment inlines), `Character`, `NPC`, and related models for Django admin (`list_display`, `fieldsets`, filters).

---

## [services/character_service.py](../../backend/src/characters/services/character_service.py)

**`CharacterService`:** Static helpers for dice/outcome helpers, vice indulgence, harm/heal stubs, XP — used to centralize mechanics-oriented logic (may be partially illustrative vs fully wired to views).

---

## [services/campaign_service.py](../../backend/src/characters/services/campaign_service.py)

**`CampaignService`:** Static helpers for creating campaigns, listing user campaigns, edit permissions (GM/staff), attaching characters, NPC visibility rules for non-GMs.

---

## [services/__init__.py](../../backend/src/characters/services/__init__.py)

Package marker for business-logic services (`character_service`, `campaign_service`).
