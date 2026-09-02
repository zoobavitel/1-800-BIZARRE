"""Reset a PC to a blank mechanical sheet while keeping identity and campaign."""

from django.db import transaction

from ..history_context import suppress_character_history_logging
from ..models import (
    Character,
    CharacterHistory,
    CharacterHamonAbility,
    CharacterSpinAbility,
    CharacterXPAllocation,
    ExperienceTracker,
    ProgressClock,
    Stand,
    StandAbility,
    StressHistory,
    XPHistory,
    _default_coin_boxes,
    _default_stash_slots,
)

_EMPTY_XP_CLOCKS = {
    "insight": 0,
    "prowess": 0,
    "resolve": 0,
    "heritage": 0,
    "playbook": 0,
}

_DEFAULT_COIN_STATS = {
    "power": "D",
    "speed": "D",
    "range": "D",
    "durability": "D",
    "precision": "D",
    "development": "D",
}


def _sync_original_data(character):
    """Align GM-lock snapshot with pending values so Character.save allows reset."""
    character._original_data = {}
    for field in character._meta.fields:
        if not field.is_relation and field.attname in character.__dict__:
            character._original_data[field.name] = character.__dict__[field.attname]


def _keep_required_heritage_picks(character):
    """Keep heritage FK. Drop optional extra benefits/detriments; keep required rows."""
    heritage = character.heritage
    if heritage is None:
        character.selected_benefits.clear()
        character.selected_detriments.clear()
        return
    character.selected_benefits.set(heritage.benefits.filter(required=True))
    character.selected_detriments.set(heritage.detriments.filter(required=True))


def _reset_stand(character):
    stand_name = (character.stand_name or "").strip() or "Unnamed Stand"
    defaults = {
        "name": stand_name,
        "type": "FIGHTING",
        "type_custom": "",
        "form": "Humanoid",
        "forms": ["Humanoid"],
        "consciousness_level": "C",
        "power": "D",
        "speed": "D",
        "range": "D",
        "durability": "D",
        "precision": "D",
        "development": "D",
        "armor": 0,
        "standard_ability": None,
    }
    stand, created = Stand.objects.get_or_create(
        character=character, defaults=defaults
    )
    if not created:
        for key, value in defaults.items():
            setattr(stand, key, value)
        stand.save()
    StandAbility.objects.filter(stand=stand).delete()
    return stand


def reset_character_sheet(character):
    """
    Clear playbook, trauma, stress, XP, dots, abilities, harm, optional
    heritage extras, and related advancement logs. Keep campaign, owner,
    name, crew, appearance, vice, heritage FK, required heritage picks,
    and flavor notes.

    Returns the refreshed Character.
    """
    with transaction.atomic():
        with suppress_character_history_logging():
            CharacterHamonAbility.objects.filter(character=character).delete()
            CharacterSpinAbility.objects.filter(character=character).delete()
            character.standard_abilities.clear()

            character.playbook = "STAND"
            character.secondary_playbook = None
            character.playbook_xp_archetypes = []
            character.stand_type = None
            character.stand_form = None
            character.stand_conscious = True
            character.coin_stats = dict(_DEFAULT_COIN_STATS)
            character.armor_type = None
            character.loadout = 1

            character.action_dots = {}
            character.stress = 0
            character.trauma = []
            character.healing_clock_segments = 4
            character.healing_clock_filled = 0

            character.light_armor_used = False
            character.medium_armor_used = False
            character.heavy_armor_used = False
            character.stand_armor_used = 0
            character.has_physical_armor_item = False
            character.physical_armor_bonus_charges = 0
            character.physical_armor_used = 0
            character.special_armor_used = 0

            character.unallocated_xp = 0
            character.xp_clocks = dict(_EMPTY_XP_CLOCKS)
            character.total_xp_spent = 0
            character.level = 1
            character.heritage_points_gained = 0
            character.stand_coin_points_gained = 0
            character.action_dice_gained = 0
            character.bonus_hp_from_xp = 0

            character.harm_level1_used = False
            character.harm_level1_name = None
            character.harm_level2_used = False
            character.harm_level2_name = None
            character.harm_level1_slot2_used = False
            character.harm_level1_slot2_name = None
            character.harm_level2_slot2_used = False
            character.harm_level2_slot2_name = None
            character.harm_level3_used = False
            character.harm_level3_name = None
            character.harm_level4_used = False
            character.harm_level4_name = None

            character.fed_today = None
            character.disguised_as_human = None
            character.inventory = []
            character.reputation_status = {}
            character.faction_reputation = []
            character.coin_boxes = _default_coin_boxes()
            character.stash_slots = _default_stash_slots()

            character.custom_ability_description = None
            character.custom_ability_type = "single_with_3_uses"
            character.extra_custom_abilities = []
            character.development_temporary_ability = None
            character.advancement_ability_grants = []

            _sync_original_data(character)
            character.save()
            _keep_required_heritage_picks(character)
            _reset_stand(character)

            CharacterXPAllocation.objects.filter(character=character).delete()
            ExperienceTracker.objects.filter(character=character).delete()
            XPHistory.objects.filter(character=character).delete()
            StressHistory.objects.filter(character=character).delete()
            CharacterHistory.objects.filter(character=character).delete()
            ProgressClock.objects.filter(
                character=character,
                campaign__isnull=True,
                crew__isnull=True,
                faction__isnull=True,
                session__isnull=True,
                npc__isnull=True,
            ).delete()

    return Character.objects.get(pk=character.pk)
