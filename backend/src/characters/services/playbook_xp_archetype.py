"""Labels for playbook-specific XP archetypes (SRD Advancement tables)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import Character

# Mirrors model choices — Stand.TYPE_CHOICES keys
_STAND_ARCH_KEYS = frozenset(
    {"COLONY", "TOOLBOUND", "PHENOMENA", "AUTOMATIC", "FIGHTING", "SHARED"}
)
_HAMON_ARCH_KEYS = frozenset(
    {
        "TRADITIONALIST",
        "ADAPTIVE_FLOW",
        "CYBER_HAMONIST",
        "DARK_RESONANCE",
        "BIO_HARMONICS",
    }
)
_SPIN_ARCH_KEYS = frozenset(
    {"CAVALIER", "EXECUTIONER", "MEDICO", "BALLBREAKER"}
)


def allowed_playbook_xp_archetype_keys(playbook: str) -> frozenset[str]:
    pb = (playbook or "STAND").upper()
    if pb == "HAMON":
        return _HAMON_ARCH_KEYS
    if pb == "SPIN":
        return _SPIN_ARCH_KEYS
    return _STAND_ARCH_KEYS


def normalize_playbook_xp_archetypes(
    playbook: str, raw: list | None
) -> list[str]:
    """Dedupe preserving order; filter to allowed keys for playbook."""
    allowed = allowed_playbook_xp_archetype_keys(playbook)
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in raw:
        k = str(x or "").strip().upper()
        if k in allowed and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def _stand_type_display(character: Character) -> str:
    stand = getattr(character, "stand", None)
    if stand is None:
        return ""
    try:
        return stand.get_type_display()
    except Exception:
        return str(getattr(stand, "type", "") or "")


def _hamon_spin_labels_from_abilities(character: Character) -> list[str]:
    from ..models import CharacterHamonAbility, CharacterSpinAbility

    labels: list[str] = []
    pb = (character.playbook or "STAND").upper()
    if pb == "HAMON":
        for ch in CharacterHamonAbility.objects.filter(
            character=character
        ).select_related("hamon_ability"):
            ha = ch.hamon_ability
            if ha and ha.hamon_type != "FOUNDATION":
                labels.append(ha.get_hamon_type_display())
    elif pb == "SPIN":
        for cs in CharacterSpinAbility.objects.filter(
            character=character
        ).select_related("spin_ability"):
            sa = cs.spin_ability
            if sa and sa.spin_type != "FOUNDATION":
                labels.append(sa.get_spin_type_display())
    dedup: list[str] = []
    seen: set[str] = set()
    for lbl in labels:
        if lbl and lbl not in seen:
            seen.add(lbl)
            dedup.append(lbl)
    return dedup


_STAND_TYPE_DISPLAY = {
    "COLONY": "Colony",
    "TOOLBOUND": "Tool Bound",
    "PHENOMENA": "Phenomena",
    "AUTOMATIC": "Automatic",
    "FIGHTING": "Fighting Spirit",
    "SHARED": "Shared",
}
_HAMON_DISPLAY = {
    "TRADITIONALIST": "Traditionalist (Zeppeli Style)",
    "ADAPTIVE_FLOW": "Adaptive Flow (Joseph/Caesar Style)",
    "CYBER_HAMONIST": "Cyber-Hamonist",
    "DARK_RESONANCE": "Dark Resonance",
    "BIO_HARMONICS": "Bio-Harmonics",
}
_SPIN_DISPLAY = {
    "CAVALIER": "Cavalier",
    "EXECUTIONER": "Executioner",
    "MEDICO": "Medico",
    "BALLBREAKER": "Ballbreaker",
}


def archetype_key_to_label(playbook: str, key: str) -> str:
    k = (key or "").strip().upper()
    pb = (playbook or "STAND").upper()
    if pb == "HAMON":
        return _HAMON_DISPLAY.get(k, k.replace("_", " ").title())
    if pb == "SPIN":
        return _SPIN_DISPLAY.get(k, k.replace("_", " ").title())
    return _STAND_TYPE_DISPLAY.get(k, k.replace("_", " ").title())


def resolve_playbook_xp_archetype_labels(character: Character) -> str:
    """Human-readable joined labels for XP descriptions and UI."""
    stored = normalize_playbook_xp_archetypes(
        character.playbook, getattr(character, "playbook_xp_archetypes", None)
    )
    if stored:
        return " · ".join(
            archetype_key_to_label(character.playbook, k) for k in stored
        )
    pb = (character.playbook or "STAND").upper()
    if pb == "STAND":
        d = _stand_type_display(character)
        if d:
            return d
    from_abilities = _hamon_spin_labels_from_abilities(character)
    if from_abilities:
        return " · ".join(from_abilities)
    return ""
