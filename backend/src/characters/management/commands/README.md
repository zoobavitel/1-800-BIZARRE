# backend/src/characters/management/commands/

Custom `manage.py` subcommands for the `characters` app. Run as:

```bash
source .venv/bin/activate
cd backend/src
python manage.py <command> [options]
```

## Catalogue (by role)

### Reference data / seeding

| Command | Purpose |
|---------|---------|
| `load_srd_reference_data` | Idempotently loads `srd_benefits` / `srd_detriments` / `standard_abilities` when empty; upserts Spin/Hamon playbook abilities and SRD equipment TEMPLATEs. Safe to re-run on prod. |
| `create_stand_playbook_test_characters` | Creates five SRD playbook example PCs (Colony, Automatic, Tool-Bound, Fighting Spirit, Phenomena) under a test account. Supports `--username`, `--password`, `--clear`. |

### User / permission helpers

| Command | Purpose |
|---------|---------|
| `create_user`, `create_test_users` | Make users for local dev / seeded test scenarios. |
| `delete_users`, `delete_slickrick_user` | Remove specific users. |
| `set_user_password`, `rename_user` | One-off user-record maintenance. |
| `list_users` | Print user list. |
| `set_gm`, `update_gm` | Toggle GM role for a user on a campaign. |
| `get_campaign_gm`, `list_gm_crews_factions` | Inspect GM / crew / faction state. |

### Campaigns / crews / factions

| Command | Purpose |
|---------|---------|
| `create_campaign` | Bootstrap a campaign row. |
| `create_crew`, `rename_crew`, `get_campaign_crew_name` | Crew lifecycle. |
| `create_new_factions`, `move_factions`, `display_campaign_factions_data` | Faction lifecycle and inspection. |

### Specific PCs / NPCs (demo + scenario data)

These hand-build named characters used in playtesting and screenshots. Treat them as scratch fixtures — they reference real user accounts and campaigns.

| Command | Purpose |
|---------|---------|
| `create_test_character` | Generic PC factory. |
| `create_npc` | Generic NPC factory. |
| `create_alecb100_jack_rice`, `create_aya_funsami`, `create_bobo_jizarre`, `create_clean_bandit`, `create_furio`, `create_lucky_luciano`, `create_mingo`, `create_solomon_weiss` | Specific PC builds. |
| `create_alonzo_fortuna_npc`, `create_mf_doom_npc` | Specific NPC builds. |
| `bind_aya_funsami_to_user`, `bind_slick_rick_to_user`, `bind_slick_rick_gulp_to_campaign`, `list_slick_ricks` | Wire those characters to specific users / campaigns. |
| `assign_and_list_characters`, `list_all_characters` | Character listing utilities. |
| `delete_solomon_weiss`, `update_solomon_weiss_xp` | One-off maintenance commands. |
| `lock_character_fields` | Apply GM-lock to a character. |

### Inspection / maintenance

| Command | Purpose |
|---------|---------|
| `display_character_data`, `display_xp_breakdown` | Pretty-print character / XP state for debugging. |
| `backup_database` | Backend-side DB snapshot (see `scripts/backup-database.sh` for the shell wrapper). |

## Conventions

- New commands go here as `<verb>_<noun>.py` with a `Command(BaseCommand)` class.
- Prefer a management command over an ad-hoc script in `characters/` or `backend/src/` — discoverability matters.
- One-off, character-specific commands are fine but should not gate prod deploys. The `load_srd_reference_data` + `create_stand_playbook_test_characters` pair is what we actually rely on.

For a deeper write-up, see [`docs/codebase/backend-commands.md`](../../../../docs/codebase/backend-commands.md).
