"""Bump Character.version when a related sheet row changes.

The sheet sends the Stand, Hamon and Spin abilities, standard abilities,
heritage benefits and detriments, and the character's progress clocks along
with the character. A stale tab would revert any of them, so a write to these
rows has to bump the character's version just like a write to the character.

Character's own writes bump in ``Character.save()`` and
``CharacterQuerySet.update()`` (``models.py``).
"""

from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from .models import (
    Character,
    CharacterHamonAbility,
    CharacterSpinAbility,
    ProgressClock,
    Stand,
    bump_character_version,
)


def _cached_character(row):
    """The in-memory Character the row points at, if already loaded."""
    field = row._meta.get_field("character")
    return row.character if field.is_cached(row) else None


def _bump_for_row(row):
    character_id = getattr(row, "character_id", None)
    if character_id:
        bump_character_version(character_id, _cached_character(row))


@receiver(post_save, sender=Stand)
@receiver(post_delete, sender=Stand)
@receiver(post_save, sender=CharacterHamonAbility)
@receiver(post_delete, sender=CharacterHamonAbility)
@receiver(post_save, sender=CharacterSpinAbility)
@receiver(post_delete, sender=CharacterSpinAbility)
@receiver(post_save, sender=ProgressClock)
@receiver(post_delete, sender=ProgressClock)
def bump_on_related_row_change(sender, instance, **kwargs):
    _bump_for_row(instance)


def bump_on_m2m_change(sender, instance, action, reverse, pk_set, **kwargs):
    if action not in ("post_add", "post_remove", "post_clear"):
        return
    if isinstance(instance, Character):
        bump_character_version(instance.pk, instance)
        return
    # Reverse side (e.g. ability.character_set.add(...)): pk_set holds the
    # characters. post_clear from that side gives no pk_set; bump nobody we
    # can't name rather than every character.
    for character_id in pk_set or ():
        bump_character_version(character_id)


for _through in (
    Character.standard_abilities.through,
    Character.selected_benefits.through,
    Character.selected_detriments.through,
):
    m2m_changed.connect(
        bump_on_m2m_change,
        sender=_through,
        dispatch_uid=f"character-version-{_through._meta.label_lower}",
    )
