# Session status — production verification and repair

Use when campaign session list shows **Planned** for finished episodes, or after deploy/migrate issues.

## 1. Confirm Django uses the same database as the API

From `backend/src` with the **production** venv and env vars (including `DJANGO_SETTINGS_MODULE=app.settings_prod` if that is what gunicorn uses):

```python
from django.conf import settings
settings.DATABASES["default"]["ENGINE"], settings.DATABASES["default"].get("NAME")
```

You want **PostgreSQL** (or your real prod engine), not `django.db.backends.sqlite3` pointing at a dev `db.sqlite3`.

## 2. Browser Network

After **End without encoded XP**, inspect:

- `PATCH /api/campaigns/<id>/` body: `skip_encoded_xp_settlement: true` when you chose skip.
- Follow-up `GET /sessions/?campaign=<id>`: each session should have `status` and `auto_encoded_xp_settled` consistent with “Ended” in the UI.

## 3. SSH / Postgres read-only

Load `DB_*` from `.env`, then:

```sql
SELECT id, name, status, auto_encoded_xp_settled
FROM characters_session
WHERE campaign_id = <CAMPAIGN_ID>
ORDER BY id;
```

If `auto_encoded_xp_settled` column is missing, run **`python manage.py migrate`** (with prod settings + env), then **restart gunicorn/celery**.

## 4. Deployed code

Confirm `characters/views/campaign_views.py` `perform_update` denormalizes previous live session to `COMPLETED` after clearing `active_session`.

## 5. Logs

```bash
journalctl -u gunicorn -u celery-worker -n 200 --no-pager
```

Search for `Encoded session XP settlement failed` and `active_session change`.

---

## One-off data repair (GM judgment, no deletes)

For episodes you **know** are finished and you **do not** want the automatic encoded XP pass to run again, **after** migration `0060_session_auto_encoded_xp_settled` exists:

```sql
BEGIN;
UPDATE characters_session
SET status = 'COMPLETED', auto_encoded_xp_settled = true
WHERE campaign_id = <CAMPAIGN_ID> AND id IN (<session_ids>);
COMMIT;
```

Do **not** use this if you still want **`settle_encoded_session_xp`** to run once for those rows; use **End & apply encoded XP** while live instead.

If you **already** granted equivalent XP manually, this SQL only fixes labels/lifecycle flags; it does not remove rolls or trackers.
