# backend/src/characters/tests/

Active test suite for the `characters` app. Discovered automatically by `python manage.py test characters`.

## Layout

Tests are split per concern. Roughly:

| Area | Files |
|------|-------|
| **Character / NPC validation** | `test_pc_validation.py`, `test_npc_validation.py`, `test_npc_summary_serializer.py`, `test_heritage_hp_budget.py`, `test_character_stash_slots.py`, `test_character_importer.py` |
| **Permissions / GM lock** | `test_character_viewset_access.py`, `test_character_permissions_and_creator.py`, `test_gm_lock.py`, `test_character_patch_clear_abilities.py` |
| **Roll / action mechanics** | `test_roll_action_assist.py`, `test_roll_action_push_exclusive.py`, `test_roll_action_npc_heal_fortune.py`, `test_assist_help_pending.py`, `test_group_action_resolve_stress.py`, `test_parry_and_break_removed.py`, `test_ripple_breathing_free_push.py` |
| **Crew / XP** | `test_crew_name_consensus.py`, `test_crew_xp_triggers.py`, `test_personal_crew_name_autoattach.py` |
| **Campaigns / sessions / SSE** | `test_campaign_active_session_status_sync.py`, `test_campaign_gm_player_management.py`, `test_campaign_sse.py` |
| **Cross-cutting integration** | `test_integration_business_flows.py` (run by `npm run test:integration:backend`) |

A legacy top-level `characters/test_legacy_models.py` exists outside this folder; it's still discovered by `manage.py test` and kept for historical model fixtures.

## Running

```bash
source .venv/bin/activate
cd backend/src
python manage.py test characters                              # whole app
python manage.py test characters.tests.test_pc_validation     # one file
python manage.py test characters.tests.test_roll_action_push_exclusive.RollActionPushTests.test_push_costs_two_stress  # one case
```

For coverage gating (CI requires ≥70%):

```bash
coverage run --source=characters manage.py test
coverage report --fail-under=70
```

## Conventions

- New rules behavior gets a test under the matching area file or a new `test_<area>.py`.
- Tests that hit the SRD should reference the relevant section so future readers can confirm intent — see [`.cursor/rules/pr-doc-links-mechanics.mdc`](../../../../.cursor/rules/pr-doc-links-mechanics.mdc).
- For the broader test pyramid (unit / integration / Playwright / manual sign-off), see [`docs/TEST_PYRAMID.md`](../../../../docs/TEST_PYRAMID.md).
