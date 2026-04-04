"""Broadcast campaign updates when session, campaign, character, or rolls change."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Campaign, Character, GroupAction, Roll, Session
from .realtime import broadcast_campaign_update


@receiver(post_save, sender=Session)
def _session_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        broadcast_campaign_update(instance.campaign_id, "session")


@receiver(post_save, sender=Campaign)
def _campaign_saved_broadcast(sender, instance, **kwargs):
    broadcast_campaign_update(instance.id, "campaign")


@receiver(post_save, sender=Character)
def _character_saved_broadcast(sender, instance, **kwargs):
    if instance.campaign_id:
        broadcast_campaign_update(instance.campaign_id, "character")


@receiver(post_save, sender=Roll)
def _roll_saved_broadcast(sender, instance, **kwargs):
    if not instance.session_id:
        return
    cid = (
        Session.objects.filter(pk=instance.session_id)
        .values_list("campaign_id", flat=True)
        .first()
    )
    if cid:
        broadcast_campaign_update(cid, "roll")


@receiver(post_save, sender=GroupAction)
def _group_action_saved_broadcast(sender, instance, **kwargs):
    if not instance.session_id:
        return
    cid = (
        Session.objects.filter(pk=instance.session_id)
        .values_list("campaign_id", flat=True)
        .first()
    )
    if cid:
        broadcast_campaign_update(cid, "group_action")
