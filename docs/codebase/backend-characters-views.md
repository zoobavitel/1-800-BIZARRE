# Characters app — views package (`backend/src/characters/views/`)

Modular DRF views; **[`__init__.py`](../../backend/src/characters/views/__init__.py)** re-exports all symbols so [app/urls.py](../../backend/src/app/urls.py) can `from characters.views import ...` from a single namespace.

The legacy **[`views.py`](../../backend/src/characters/views.py)** (parent of `views/`) still contains additional viewsets and functions — prefer importing from **`characters.views`** (package) for anything listed in `views/__init__.py`. See [backend-characters-core.md](backend-characters-core.md) for the `views.py` barrel caveat.

**Router prefix:** All registered routes live under `/api/` (see [backend-app.md](backend-app.md)).

---

## [auth_views.py](../../backend/src/characters/views/auth_views.py)

| Symbol | Role |
|--------|------|
| `RegisterView` | User signup |
| `LoginView` | Token login (`ObtainAuthToken` subclass) |
| `CurrentUserView` | Authenticated user + profile |
| `UserProfileViewSet` | Profile CRUD (avatar, theme, notifications) |

**Auth:** `IsAuthenticated` on profile; signup/login allow unauthenticated as implemented in each class.

---

## [character_views.py](../../backend/src/characters/views/character_views.py)

| Symbol | Role |
|--------|------|
| `_character_queryset_for_user` | PCs owned by user **or** in campaigns the user GMs; staff sees all |
| `CharacterViewSet` | Full PC CRUD; `MultipartJsonParser` for image + JSON; `get_queryset` uses helper; destroy limited to owner (or staff); custom actions e.g. `creation_guide`, `update_field`, field-GM locks |

**Queryset rule:** Players see their characters; GMs additionally see PCs in campaigns they run.

---

## [campaign_views.py](../../backend/src/characters/views/campaign_views.py)

| Symbol | Role |
|--------|------|
| `CampaignViewSet` | Campaigns where user is GM, player (`players` M2M), or has a character; GM-only update; `perform_create` sets GM to current user; actions: `invite_player`, `invitable_users`, etc. |
| `ShowcasedNPCViewSet` | Showcased NPCs tied to campaigns/sessions |
| `CampaignInvitationViewSet` | Accept/decline invitations |

---

## [crew_views.py](../../backend/src/characters/views/crew_views.py)

| Symbol | Role |
|--------|------|
| `CrewViewSet` | Crew CRUD + campaign-scoped logic (check file for `get_queryset` / GM rules) |

---

## [faction_views.py](../../backend/src/characters/views/faction_views.py)

| Symbol | Role |
|--------|------|
| `FactionViewSet` | Faction CRUD per campaign |

---

## [npc_views.py](../../backend/src/characters/views/npc_views.py)

| Symbol | Role |
|--------|------|
| `NPCViewSet` | NPC CRUD; GM/creator visibility rules in `get_queryset` / permissions |

---

## [session_views.py](../../backend/src/characters/views/session_views.py)

| Symbol | Role |
|--------|------|
| `IsCampaignGMOrReadOnly` | Safe methods allowed broadly; writes require campaign GM (or staff) on object |
| `SessionViewSet` | Sessions in campaigns where user is GM or member; `retrieve` uses `SessionRecordsSerializer`; GM updates; actions `propose_score`, `vote_for_score` |
| `SessionEventViewSet` | Events filtered to sessions in accessible campaigns |

---

## [roll_views.py](../../backend/src/characters/views/roll_views.py)

| Symbol | Role |
|--------|------|
| `RollViewSet` | Dice rolls and persistence (roll history) |

---

## [reference_views.py](../../backend/src/characters/views/reference_views.py)

| Symbol | Role |
|--------|------|
| `HeritageViewSet`, `ViceViewSet`, `AbilityViewSet`, `StandViewSet`, `StandAbilityViewSet` | Reference catalogs |
| `HamonAbilityViewSet`, `SpinAbilityViewSet` | Playbook ability lists |
| `TraumaViewSet` | Read-only trauma catalog |
| `CharacterHistoryViewSet` | Read-only history |
| `ExperienceTrackerViewSet` | XP tracker CRUD |

---

## [gameplay_views.py](../../backend/src/characters/views/gameplay_views.py)

| Symbol | Role |
|--------|------|
| `ClaimViewSet`, `CrewSpecialAbilityViewSet`, `CrewPlaybookViewSet`, `CrewUpgradeViewSet` | Crew meta resources |
| `XPHistoryViewSet`, `StressHistoryViewSet` | History tables |
| `ChatMessageViewSet` | Chat |
| `ProgressClockViewSet` | Progress clocks |

---

## [utility_views.py](../../backend/src/characters/views/utility_views.py)

| Symbol | Role |
|--------|------|
| `home` | Non-API home endpoint |
| `SpendCoinAPIView` | Spend coin action |
| `global_search` | Search across entities (`/api/search/`) |
| `get_available_playbook_abilities` | Playbook ability picker helper |
| `api_documentation` | Simple API docs HTML/JSON |

---

## [views/README.md](../../backend/src/characters/views/README.md)

Internal notes about the views package (may include examples; keep in sync when refactoring).
