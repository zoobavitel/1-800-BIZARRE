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
