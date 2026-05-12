"""
Credit crew-level XP from Blades-style crew XP trigger toggles.

Each `Crew.session_xp_triggers["<session_id>"]` row holds three booleans
(`challenge`, `reputation`, `goals`) that crew members may toggle during the
session via the CharacterSheet "CREW XP TRIGGERS" panel. When the campaign's
`active_session` changes (handled in `views/campaign_views.py.perform_update`),
this service walks every crew on the campaign and, for the previous session,
credits +1 Crew.xp per toggled trigger (capped at `xp_track_size`). The session
row is then flagged `credited=True` so re-running the sweep is a no-op.

SRD parity: matches Blades end-of-session crew XP — "for each trigger that
happened, mark 1 xp". Toggles are yes/no per trigger. Session
`session_rep_contributions` (per-character edge counts on the reputation
toggle) are summed into `Crew.rep` once per session (capped at 6, matching the
sheet rep track).
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction

from ..models import Crew, Session

logger = logging.getLogger(__name__)

_TRIGGER_KEYS: tuple[str, ...] = ("challenge", "reputation", "goals")


def _count_toggled(row: dict[str, Any]) -> int:
    return sum(1 for k in _TRIGGER_KEYS if bool(row.get(k)))


def credit_crew_xp_triggers_for_session(
    session: Session, acting_user: Any = None
) -> dict:
    """Convert toggled crew XP triggers for `session` into +1 Crew.xp each.

    Idempotent: rows with `credited=True` are skipped. Returns a small summary
    payload (used by the caller for audit logging, not exposed to clients).
    """
    if session is None:
        return {"session_id": None, "applied": []}
    out: dict[str, Any] = {"session_id": session.id, "applied": []}
    sid_str = str(session.id)
    with transaction.atomic():
        crews = list(
            Crew.objects.select_for_update().filter(campaign_id=session.campaign_id)
        )
        for crew in crews:
            data = dict(crew.session_xp_triggers or {})
            row = data.get(sid_str)
            if not isinstance(row, dict):
                continue
            if row.get("credited"):
                continue
            toggled = _count_toggled(row)
            rep_data = dict(crew.session_rep_contributions or {})
            contrib_row = rep_data.pop(sid_str, None)
            bonus_rep = 0
            if isinstance(contrib_row, dict):
                for v in contrib_row.values():
                    try:
                        bonus_rep += max(0, int(v))
                    except (TypeError, ValueError):
                        continue
            rep_cap = 6
            cur_rep = max(0, int(crew.rep or 0))
            new_rep = min(rep_cap, cur_rep + bonus_rep) if bonus_rep else cur_rep
            if toggled <= 0:
                # Still mark credited so a stale empty row doesn't get
                # re-processed on every PATCH.
                row["credited"] = True
                data[sid_str] = row
                crew.session_xp_triggers = data
                crew.session_rep_contributions = rep_data
                update_fields = ["session_xp_triggers", "session_rep_contributions"]
                if bonus_rep:
                    crew.rep = new_rep
                    update_fields.insert(0, "rep")
                crew.save(update_fields=update_fields)
                continue
            cap = max(0, int(crew.xp_track_size or 0))
            cur = max(0, int(crew.xp or 0))
            new_xp = min(cap, cur + toggled) if cap > 0 else cur + toggled
            granted = new_xp - cur
            row["credited"] = True
            data[sid_str] = row
            crew.xp = new_xp
            crew.session_xp_triggers = data
            crew.session_rep_contributions = rep_data
            save_fields = ["xp", "session_xp_triggers", "session_rep_contributions"]
            if bonus_rep:
                crew.rep = new_rep
                save_fields.insert(1, "rep")
            crew.save(update_fields=save_fields)
            out["applied"].append(
                {
                    "crew_id": crew.id,
                    "toggled": toggled,
                    "xp_granted": granted,
                    "xp_after": new_xp,
                    "xp_track_size": cap,
                }
            )
    logger.info(
        "crew_xp_triggers credited session=%s user=%s applied=%s",
        session.id,
        getattr(acting_user, "id", None),
        out["applied"],
    )
    return out
