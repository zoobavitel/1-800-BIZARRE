"""Broadcast campaign updates when relevant rows change.

Subscribers (frontend `subscribeCampaignEvents`) refetch their panel-level
data on any `campaign_update` event for the matching campaign. We coalesce
on the client side, so it is fine to emit a few extra events here — we'd
rather over-broadcast and keep panels honest than miss a change.

Broadcasts run on ``transaction.on_commit`` so listeners never see
half-applied credit_xp / allocation state.
"""

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import (
    Campaign,
    Character,
    Crew,
    ExperienceTracker,
    Faction,
    GroupAction,
    NPC,
    AdvancementPlanItem,
    PendingAdvance,
    ProgressClock,
    Roll,
    Session,
)
from .realtime import broadcast_campaign_update


def _broadcast_after_commit(campaign_id, reason: str) -> None:
    if not campaign_id:
        return

    def _send():
        broadcast_campaign_update(campaign_id, reason)

    transaction.on_commit(_send)


def _campaign_id_for_session(session_id):
    if not session_id:
        return None
    return (
        Session.objects.filter(pk=session_id)
        .values_list("campaign_id", flat=True)
        .first()
    )


def _campaign_id_for_clock(instance):
    """Resolve campaign id for any ProgressClock variant (campaign/crew/char/faction)."""
    if instance.campaign_id:
        return instance.campaign_id
    if instance.character_id:
        return (
            Character.objects.filter(pk=instance.character_id)
            .values_list("campaign_id", flat=True)
            .first()
        )
    if instance.crew_id:
        return (
            Crew.objects.filter(pk=instance.crew_id)
            .values_list("campaign_id", flat=True)
            .first()
        )
    if instance.faction_id:
        return (
            Faction.objects.filter(pk=instance.faction_id)
            .values_list("campaign_id", flat=True)
            .first()
        )
    return None


def _campaign_id_for_xp(instance):
    if instance.character_id:
        return (
            Character.objects.filter(pk=instance.character_id)
            .values_list("campaign_id", flat=True)
            .first()
        )
    return None


@receiver(post_save, sender=Session)
def _session_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        _broadcast_after_commit(instance.campaign_id, "session")


@receiver(post_save, sender=Campaign)
def _campaign_saved_broadcast(sender, instance, **kwargs):
    _broadcast_after_commit(instance.id, "campaign")


@receiver(post_save, sender=Character)
def _character_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        _broadcast_after_commit(instance.campaign_id, "character")


@receiver(post_save, sender=Roll)
def _roll_saved_broadcast(sender, instance, **kwargs):
    cid = _campaign_id_for_session(instance.session_id)
    if cid:
        _broadcast_after_commit(cid, "roll")


@receiver(post_save, sender=GroupAction)
def _group_action_saved_broadcast(sender, instance, **kwargs):
    cid = _campaign_id_for_session(instance.session_id)
    if cid:
        _broadcast_after_commit(cid, "group_action")


@receiver(post_save, sender=ProgressClock)
@receiver(post_delete, sender=ProgressClock)
def _progress_clock_changed_broadcast(sender, instance, **kwargs):
    cid = _campaign_id_for_clock(instance)
    if cid:
        _broadcast_after_commit(cid, "progress_clock")


@receiver(post_save, sender=ExperienceTracker)
@receiver(post_delete, sender=ExperienceTracker)
def _experience_tracker_changed_broadcast(sender, instance, **kwargs):
    """Cover trigger toggles, GM/player manual grants, and auto-encoded XP.

    Session XP scorecards + character-sheet trigger pips read from this
    table, so a delete-to-rollback must also pulse the campaign stream.
    """
    cid = _campaign_id_for_xp(instance)
    if cid:
        _broadcast_after_commit(cid, "experience_tracker")


@receiver(post_save, sender=PendingAdvance)
@receiver(post_delete, sender=PendingAdvance)
def _pending_advance_changed_broadcast(sender, instance, **kwargs):
    cid = _campaign_id_for_xp(instance)
    if cid:
        _broadcast_after_commit(cid, "pending_advance")


@receiver(post_save, sender=AdvancementPlanItem)
@receiver(post_delete, sender=AdvancementPlanItem)
def _advancement_plan_item_changed_broadcast(sender, instance, **kwargs):
    cid = _campaign_id_for_xp(instance)
    if cid:
        _broadcast_after_commit(cid, "advancement_plan")


@receiver(post_save, sender=Crew)
def _crew_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        _broadcast_after_commit(instance.campaign_id, "crew")


@receiver(post_save, sender=NPC)
def _npc_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        _broadcast_after_commit(instance.campaign_id, "npc")


@receiver(post_save, sender=Faction)
def _faction_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        _broadcast_after_commit(instance.campaign_id, "faction")
