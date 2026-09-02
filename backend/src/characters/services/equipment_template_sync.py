"""Canonical SRD TEMPLATE equipment kits — fixture + migrate + seed share this list."""

from __future__ import annotations

from characters.models import EquipmentItem

# Blades-style flexible kits (one row each). Detail examples live in description.
CANONICAL_SRD_EQUIPMENT_TEMPLATES = [
    {
        "name": "A Blade or Two",
        "description": "One or two blades for close work — knives, short swords, or similar.",
        "category": "weapons",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Throwing Knives",
        "description": "A set of balanced knives for throwing at range.",
        "category": "weapons",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "A Pistol",
        "description": "A handgun — revolver, semi-auto, or similar.",
        "category": "weapons",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "A Large Weapon",
        "description": "A heavy or longarm weapon — rifle, shotgun, polearm, or similar.",
        "category": "weapons",
        "load_slots": 2,
        "quality": 1,
    },
    {
        "name": "Burglary Gear",
        "description": "Breaking-and-entering kit — crowbar, picks, glass cutter, etc.",
        "category": "gear",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Climbing Gear",
        "description": "Ropes, harness, pitons, and ascent kit.",
        "category": "gear",
        "load_slots": 2,
        "quality": 1,
    },
    {
        "name": "Bizarre Implements",
        "description": "Strange or supernatural tools — foci, charms, bizarre gadgets.",
        "category": "implements",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Documents",
        "description": "Papers and covers — forged IDs, ledgers, maps, blueprints.",
        "category": "documents",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Subterfuge Supplies",
        "description": "Deception kit — mask, disguise, makeup, distraction props.",
        "category": "supplies",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Demolition Tools",
        "description": "Explosives and breaching gear — charges, detonators, cutters.",
        "category": "tools",
        "load_slots": 2,
        "quality": 1,
    },
    {
        "name": "Tinkering Tools",
        "description": "Repair and jury-rig kit — wrenches, wire, spare parts.",
        "category": "tools",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Lantern",
        "description": "Portable light source — oil lantern, electric lamp, or similar.",
        "category": "gear",
        "load_slots": 1,
        "quality": 1,
    },
    {
        "name": "Night Vision Goggles",
        "description": "Low-light / IR optics for seeing in the dark.",
        "category": "gear",
        "load_slots": 1,
        "quality": 1,
    },
]

CANONICAL_TEMPLATE_NAMES = frozenset(
    row["name"] for row in CANONICAL_SRD_EQUIPMENT_TEMPLATES
)


def sync_srd_equipment_templates(*, prune_obsolete: bool = True) -> dict:
    """
    Upsert TEMPLATE EquipmentItem rows by name.
    When prune_obsolete, delete TEMPLATE rows whose names are not canonical.
    Collapses duplicate TEMPLATE rows that share the same name.
    """
    created = 0
    updated = 0
    for row in CANONICAL_SRD_EQUIPMENT_TEMPLATES:
        matches = list(
            EquipmentItem.objects.filter(scope="TEMPLATE", name=row["name"]).order_by(
                "id"
            )
        )
        defaults = {
            "description": row["description"],
            "category": row["category"],
            "load_slots": row["load_slots"],
            "quality": row["quality"],
            "coin_value": None,
            "campaign": None,
            "available_when_adding": True,
        }
        if not matches:
            EquipmentItem.objects.create(scope="TEMPLATE", name=row["name"], **defaults)
            created += 1
            continue
        obj = matches[0]
        for field, value in defaults.items():
            setattr(obj, field, value)
        obj.save()
        updated += 1
        if len(matches) > 1:
            EquipmentItem.objects.filter(
                id__in=[m.id for m in matches[1:]]
            ).delete()

    deleted = 0
    if prune_obsolete:
        obsolete = EquipmentItem.objects.filter(scope="TEMPLATE").exclude(
            name__in=CANONICAL_TEMPLATE_NAMES
        )
        deleted, _ = obsolete.delete()

    return {"created": created, "updated": updated, "deleted": deleted}
