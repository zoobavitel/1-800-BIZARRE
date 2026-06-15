"""Canonical AcroForm field names for PC and NPC sheet PDF templates."""

from __future__ import annotations

PC_TEXT_FIELDS = (
    "pc_name",
    "pc_stand_name",
    "pc_crew",
    "pc_look",
    "pc_background",
    "pc_heritage",
    "pc_vice",
    "pc_campaign",
    "pc_playbook",
    "pc_playbook_archetypes",
    "pc_stand_power",
    "pc_stand_speed",
    "pc_stand_range",
    "pc_stand_durability",
    "pc_stand_precision",
    "pc_stand_development",
    "pc_action_hunt",
    "pc_action_study",
    "pc_action_survey",
    "pc_action_tinker",
    "pc_action_finesse",
    "pc_action_prowl",
    "pc_action_skirmish",
    "pc_action_wreck",
    "pc_action_bizarre",
    "pc_action_command",
    "pc_action_consort",
    "pc_action_sway",
    "pc_harm_l4",
    "pc_harm_l3",
    "pc_harm_l2",
    "pc_harm_l2_slot2",
    "pc_harm_l1",
    "pc_harm_l1_slot2",
    "pc_armor_stand",
    "pc_armor_physical",
    "pc_unallocated_xp",
    "pc_abilities",
    "pc_abilities_overflow",
    "pc_notes",
    "pc_inventory",
    "pc_heritage_picks",
    "pc_clock_1_name",
    "pc_clock_2_name",
    "pc_clock_3_name",
    "pc_clock_4_name",
)

PC_CHECKBOX_PREFIXES = (
    "pc_stress_",
    "pc_trauma_",
    "pc_healing_",
    "pc_coin_",
    "pc_stash_",
    "pc_xp_",
    "pc_clock_1_seg_",
    "pc_clock_2_seg_",
    "pc_clock_3_seg_",
    "pc_clock_4_seg_",
)

STAND_STAT_KEYS = (
    "power",
    "speed",
    "range",
    "durability",
    "precision",
    "development",
)

ACTION_KEYS = (
    "hunt",
    "study",
    "survey",
    "tinker",
    "finesse",
    "prowl",
    "skirmish",
    "wreck",
    "bizarre",
    "command",
    "consort",
    "sway",
)

TRAUMA_KEYS = (
    "cold",
    "haunted",
    "obsessed",
    "paranoid",
    "reckless",
    "soft",
    "unstable",
    "vicious",
)

XP_TRACK_KEYS = ("insight", "prowess", "resolve", "heritage", "playbook")

STAND_PATH_ARMOR_BY_GRADE = {"F": 0, "D": 1, "C": 2, "B": 3, "A": 4, "S": 5}

MAX_STRESS_SLOTS = 13
MAX_COIN_BOXES = 4
MAX_STASH_SLOTS = 40
MAX_HEALING_SEGMENTS = 8
MAX_CLOCK_SEGMENTS = 8
MAX_XP_PER_TRACK = 8
MAX_XP_PLAYBOOK_TRACK = 10


def xp_track_max_segments(track: str) -> int:
    """Playbook XP track holds 10 marks; other attribute tracks hold 8."""
    return MAX_XP_PLAYBOOK_TRACK if track == "playbook" else MAX_XP_PER_TRACK

NPC_TEXT_FIELDS = (
    "npc_name",
    "npc_stand_name",
    "npc_look",
    "npc_role",
    "npc_heritage",
    "npc_playbook",
    "npc_campaign",
    "npc_faction",
    "npc_stand_power",
    "npc_stand_speed",
    "npc_stand_range",
    "npc_stand_durability",
    "npc_stand_precision",
    "npc_stand_development",
    "npc_weakness",
    "npc_need",
    "npc_desire",
    "npc_rumour",
    "npc_secret",
    "npc_passion",
    "npc_description",
    "npc_stand_description",
    "npc_stand_appearance",
    "npc_stand_manifestation",
    "npc_special_traits",
    "npc_abilities",
    "npc_abilities_overflow",
    "npc_notes",
    "npc_inventory_notes",
    "npc_inventory",
    "npc_contacts",
    "npc_faction_status",
    "npc_relationships",
    "npc_vulnerability",
    "npc_armor_regular",
    "npc_armor_stand",
    "npc_armor_special",
    "npc_armor_physical",
    "npc_clock_1_name",
    "npc_clock_2_name",
    "npc_clock_3_name",
    "npc_clock_4_name",
)

NPC_CHECKBOX_PREFIXES = (
    "npc_vuln_seg_",
    "npc_clock_1_seg_",
    "npc_clock_2_seg_",
    "npc_clock_3_seg_",
    "npc_clock_4_seg_",
)
