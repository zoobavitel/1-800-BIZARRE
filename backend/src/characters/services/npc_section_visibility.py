"""Campaign-level per-section visibility for NPC sheets."""

NPC_PLAYERS_SEE_KEYS = (
    "playbook",
    "abilities",
    "pc_standing",
    "faction_membership",
    "notes",
    "stand_identity",
    "heritage",
    "forms",
    "consciousness",
    "contacts",
    "crew_standing",
)


def normalize_npc_players_see(value):
    """Keep known keys only. Missing keys stay missing (treated as visible)."""
    if not isinstance(value, dict):
        return {}
    out = {}
    for key in NPC_PLAYERS_SEE_KEYS:
        if key in value:
            out[key] = bool(value[key])
    return out


def npc_section_visible(players_see, key):
    if not isinstance(players_see, dict):
        return True
    return players_see.get(key, True) is not False


def player_sees_faction_membership(npc):
    """Link is visible only when the NPC, the flag, and the faction all allow it."""
    if not getattr(npc, "visible_to_players", True):
        return False
    if not npc_section_visible(getattr(npc, "players_see", None), "faction_membership"):
        return False
    faction = getattr(npc, "faction", None)
    if faction is None:
        return False
    if not getattr(faction, "visible_to_players", False):
        return False
    if not getattr(faction, "players_see_npcs", True):
        return False
    return True


def redact_npc_player_payload(data, npc):
    """Blank NPC-owned sections a non-GM must not see. Mutates data."""
    see = getattr(npc, "players_see", None)
    if not npc_section_visible(see, "playbook"):
        data["playbook"] = ""
    if not npc_section_visible(see, "abilities"):
        data["abilities"] = []
        data["custom_abilities"] = ""
        if "selected_hamon_abilities" in data:
            data["selected_hamon_abilities"] = []
        if "selected_spin_abilities" in data:
            data["selected_spin_abilities"] = []
    if not npc_section_visible(see, "pc_standing"):
        data["pc_standing"] = {}
    if not npc_section_visible(see, "notes"):
        data["notes"] = ""
    if not npc_section_visible(see, "stand_identity"):
        data["stand_name"] = ""
        data["stand_description"] = ""
        data["stand_appearance"] = ""
        data["stand_manifestation"] = ""
        data["special_traits"] = ""
        data["stand_identity_types"] = []
        data["stand_type_custom"] = ""
    if not npc_section_visible(see, "heritage"):
        data["heritage"] = None
        data["heritage_details"] = None
        data["selected_benefits"] = []
        data["selected_detriments"] = []
    if not npc_section_visible(see, "forms"):
        data["stand_forms"] = []
    if not npc_section_visible(see, "consciousness"):
        data["stand_consciousness"] = ""
    if not npc_section_visible(see, "crew_standing"):
        data["crew_standing"] = {}
    # Personal contact list. Shared faction contacts use the faction flag.
    if not npc_section_visible(see, "contacts"):
        data["contacts"] = []
    if not player_sees_faction_membership(npc):
        data["faction"] = None
    return data


# Old narrative fields with no player-facing section. Never sent to players.
NPC_PLAYER_NEVER_TEXT_FIELDS = (
    "secret",
    "rumour",
    "weakness",
    "need",
    "desire",
    "passion",
)


def npc_clock_picks(clock):
    """User ids a JSON NPC clock is limited to. Empty: the usual reveal rules."""
    raw = clock.get("visible_to") if isinstance(clock, dict) else None
    if not isinstance(raw, list):
        return set()
    picks = set()
    for value in raw:
        try:
            picks.add(int(value))
        except (TypeError, ValueError):
            continue
    return picks


def npc_clocks_for_player(all_clocks, revealed, npc, user):
    """The NPC clocks one player sees, without the list of who was picked.

    A clock with picks goes only to those players while the NPC's See is on.
    Any other clock follows the session reveal (``revealed``).
    """
    user_id = getattr(user, "id", None)
    see_on = bool(getattr(npc, "visible_to_players", True))
    out = []
    for clock in all_clocks or []:
        picks = npc_clock_picks(clock)
        shown = (see_on and user_id in picks) if picks else clock in revealed
        if shown:
            out.append(
                {k: v for k, v in clock.items() if k != "visible_to"}
                if isinstance(clock, dict)
                else clock
            )
    return out


def player_session_reveals(npc, inv):
    """Clocks and Stand coin a player may see for one session involvement.

    ``inv`` is the NPC's SessionNPCInvolvement in the campaign's active session,
    or None (nothing revealed).
    """
    if inv is None:
        return {
            "show_all_clocks": False,
            "show_vulnerability": False,
            "conflict_clocks": [],
            "alt_clocks": [],
            "revealed_progress_clock_ids": set(),
            "stand_coin_stats": {},
        }
    show_all = bool(inv.show_clocks_to_players)
    revealed_conflict = set(inv.revealed_conflict_clock_names or [])
    revealed_alt = set(inv.revealed_alt_clock_names or [])
    # When Master "Clocks" (show_clocks_to_players) is off, rely only on
    # session reveal lists—not per-clock JSON flags on the NPC—which would
    # bypass what the GM expects from the session toggle (see SessionNPCInvolvement).
    conflict_clocks = (
        list(npc.conflict_clocks or [])
        if show_all
        else [
            c
            for c in (npc.conflict_clocks or [])
            if str(c.get("name") or "") in revealed_conflict
        ]
    )
    alt_clocks = (
        list(npc.alt_clocks or [])
        if show_all
        else [
            c
            for c in (npc.alt_clocks or [])
            if str(c.get("name") or "") in revealed_alt
        ]
    )
    stand_stats = {}
    if inv.show_stand_coin_to_players:
        revealed_stats = [str(k).upper() for k in (inv.revealed_stand_coin_stats or [])]
        if revealed_stats:
            for key in revealed_stats:
                if key in (npc.stand_coin_stats or {}):
                    stand_stats[key] = npc.stand_coin_stats.get(key)
        else:
            stand_stats = npc.stand_coin_stats or {}
    return {
        "show_all_clocks": show_all,
        "show_vulnerability": show_all or bool(inv.show_vulnerability_clock_to_players),
        "conflict_clocks": conflict_clocks,
        "alt_clocks": alt_clocks,
        "revealed_progress_clock_ids": {
            int(i) for i in (inv.revealed_progress_clock_ids or []) if str(i).isdigit()
        },
        "stand_coin_stats": stand_stats,
    }


def active_session_involvement(npc):
    """The NPC's involvement in its campaign's active session, or None."""
    from ..models import SessionNPCInvolvement

    campaign = getattr(npc, "campaign", None)
    active_sid = getattr(campaign, "active_session_id", None) if campaign else None
    if not active_sid:
        return None
    return SessionNPCInvolvement.objects.filter(session_id=active_sid, npc=npc).first()


def redact_npc_hidden_fields_for_player(data, npc, user=None):
    """Strip NPC data with no player section, or not revealed this session. Mutates data."""
    for field in NPC_PLAYER_NEVER_TEXT_FIELDS:
        if field in data:
            data[field] = ""
    if "relationships" in data:
        data["relationships"] = {}
    rev = player_session_reveals(npc, active_session_involvement(npc))
    data["stand_coin_stats"] = rev["stand_coin_stats"]
    data["conflict_clocks"] = npc_clocks_for_player(
        npc.conflict_clocks, rev["conflict_clocks"], npc, user
    )
    data["alt_clocks"] = npc_clocks_for_player(
        npc.alt_clocks, rev["alt_clocks"], npc, user
    )
    if not rev["show_vulnerability"]:
        # None (not 0): S-Durability NPCs legitimately have a 0-segment clock.
        data["vulnerability_clock_current"] = None
        data["vulnerability_clock_max"] = None
    if not player_sees_faction_membership(npc):
        data["faction_status"] = {}
    return data


def redact_npc_summary_for_player(data, npc):
    see = getattr(npc, "players_see", None)
    if not npc_section_visible(see, "playbook"):
        data["playbook"] = ""
    if not npc_section_visible(see, "heritage"):
        data["heritage_name"] = None
    if not npc_section_visible(see, "stand_identity"):
        data["stand_name"] = ""
    if not npc_section_visible(see, "pc_standing") or not getattr(
        npc, "visible_to_players", True
    ):
        data["pc_standing"] = {}
    if not npc_section_visible(see, "crew_standing"):
        data["crew_standing"] = {}
    return data
