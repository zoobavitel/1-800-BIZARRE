# Management commands and loose scripts

**Run management commands from** `backend/src/` **with venv active:**

```bash
cd backend/src && python manage.py <command_name>
```

Shell backup: [scripts/backup-database.sh](../../scripts/backup-database.sh). Narrative: [scripts.md](scripts.md). Django command `backup_database` delegates to that script.

---

## Management commands (`characters/management/commands/`)

| Command | Category | Purpose (summary) |
|---------|----------|-------------------|
| `backup_database` | Operational | Invokes repo `scripts/backup-database.sh` |
| `list_users` | Operational | Lists Django users |
| `list_all_characters` | Operational | Lists characters |
| `list_gm_crews_factions` | Operational | GM/crew/faction listing |
| `list_slick_ricks` | Operational | Targeted list (campaign-specific NPC/user) |
| `display_character_data` | Operational | Prints character payload for debugging |
| `display_xp_breakdown` | Operational | XP breakdown display |
| `display_campaign_factions_data` | Operational | Campaign faction dump |
| `get_campaign_gm` | Operational | Shows GM for a campaign |
| `get_campaign_crew_name` | Operational | Crew name info |
| `set_user_password` | Operational | Sets a user password |
| `set_gm` | Operational | Assigns GM on a campaign |
| `update_gm` | Operational | Updates GM |
| `rename_user` | Operational | Renames user |
| `rename_crew` | Operational | Renames crew |
| `delete_users` | Operational | Bulk user delete (dangerous) |
| `delete_slickrick_user` | Operational | Deletes specific user |
| `assign_and_list_characters` | Operational | Assign/list characters |
| `lock_character_fields` | Operational | GM lock fields on characters |
| `move_factions` | Operational | Faction data move |
| `create_user` | Operational / seed | Creates a user |
| `create_test_users` | Seed | Test users |
| `create_test_character` | Seed | Single test PC |
| `create_stand_playbook_test_characters` | Seed | Stand playbook test PCs |
| `create_campaign` | Seed | New campaign |
| `create_crew` | Seed | New crew |
| `create_npc` | Seed | Generic NPC helper |
| `create_new_factions` | Seed | Factions for a campaign |
| `create_solomon_weiss` | Content | Specific NPC seed |
| `delete_solomon_weiss` | Content | Removes that NPC |
| `update_solomon_weiss_xp` | Content | XP tweak for that NPC |
| `create_mf_doom_npc` | Content | Specific NPC |
| `create_alonzo_fortuna_npc` | Content | Specific NPC |
| `create_clean_bandit` | Content | Specific NPC |
| `create_furio` | Content | Specific NPC |
| `create_mingo` | Content | Specific NPC |
| `create_bobo_jizarre` | Content | Specific NPC |
| `create_lucky_luciano` | Content | Specific NPC |
| `create_aya_funsami` | Content | Specific NPC |
| `create_alecb100_jack_rice` | Content | Specific NPC |
| `bind_aya_funsami_to_user` | Content | Links NPC/user |
| `bind_slick_rick_to_user` | Content | Links NPC/user |
| `bind_slick_rick_gulp_to_campaign` | Content | Campaign binding |

**Category legend**

- **Operational:** Safe-ish introspection or admin fixes; still run only with understanding.
- **Seed:** Generic test/demo data.
- **Content:** Named demo/NPC scenarios; often one-off for a table or story.

For exact arguments, read each file’s `add_arguments` and `handle` docstrings.

---

## Loose Python scripts (`backend/src/` root and misc)

These are **not** registered `manage.py` commands unless noted. Many are one-off maintenance; treat as examples unless you own the migration.

| Path | Role |
|------|------|
| `create_users.py`, `create_test_characters.py`, `create_campaign.py` | Legacy or alternate seed entrypoints |
| `game_entities_overview.py` | Entity overview dump / analysis |
| `clean_heritages.py`, `cleanup_duplicates.py`, `check_*`, `compare_*`, `rename_test_characters.py` | Data hygiene / checks |
| `temp_list_characters.py`, `temp_query.py`, `temp_update_gm.py`, `check_daniel_dumile_temp.py` | Temporary dev scripts (may be stale) |
| `get_pooj_token.py`, `get_zoob_token.py` | Local token helpers (dev convenience) |

**Other apps:** `authentication/`, `campaigns/`, `crews/`, `factions/` exist under `backend/src/` with their own `models`/`views` — smaller than `characters`. Explore before relying on them in production; main product API is `characters` + `app.urls`.

---

## Related

- [scripts.md](scripts.md) — shell backup and deploy
- [backend-app.md](backend-app.md) — settings and `manage.py`
