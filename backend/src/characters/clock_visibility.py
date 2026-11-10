"""Who can see a progress clock.

One rule, used by the clock API, the campaign payload and the PC sheet.

- The campaign GM sees every clock in the campaign.
- The clock's creator always sees it.
- "All players": `visible_to_players` on a GM clock, `visible_to_party` on a
  player's clock. Every player in the campaign sees it.
- Some players: users listed in `visible_to` see it.
- Nobody else. A GM clock with no players chosen is GM only, even when it
  sits on a player's PC.

GM clocks tied to a session show to players only while that session is the
active one (or when they have no session), as before. NPC clocks with no
creator show to players only while the NPC is showcased.
"""

from django.db.models import Exists, F, OuterRef, Q

from .models import Campaign, Character, ProgressClock, ShowcasedNPC


def member_campaign_ids(user):
    """Campaigns the user plays in (as a player or through a PC)."""
    ids = set(Campaign.objects.filter(players=user).values_list("id", flat=True))
    ids.update(
        Character.objects.filter(user=user, campaign__isnull=False).values_list(
            "campaign_id", flat=True
        )
    )
    return ids


def visible_clocks_q(user):
    """A Q that keeps only the clocks `user` may see."""
    if user is None or not getattr(user, "is_authenticated", False):
        return Q(pk__in=[])

    gm_made = Q(created_by__isnull=True) | Q(created_by_id=F("campaign__gm_id"))
    player_made = Q(created_by__isnull=False) & ~Q(created_by_id=F("campaign__gm_id"))
    session_ok = Q(session__isnull=True) | Q(
        session_id=F("campaign__active_session_id")
    )
    showcased = Exists(
        ShowcasedNPC.objects.filter(
            campaign_id=OuterRef("campaign_id"), npc_id=OuterRef("npc_id")
        )
    )
    chosen_ids = ProgressClock.visible_to.through.objects.filter(
        user_id=user.id
    ).values("progressclock_id")

    for_all_players = (
        # Legacy and NPC clocks with no creator.
        (
            Q(created_by__isnull=True, visible_to_players=True)
            & (Q(npc__isnull=True) | showcased)
        )
        # The GM's clocks shared with every player.
        | (Q(created_by_id=F("campaign__gm_id"), visible_to_players=True) & session_ok)
        # A player's clock shared with the whole party.
        | (player_made & Q(visible_to_party=True))
    )
    for_chosen_players = Q(pk__in=chosen_ids) & (
        player_made | (gm_made & session_ok)
    )
    as_player = Q(campaign_id__in=member_campaign_ids(user)) & (
        Q(created_by_id=user.id) | for_all_players | for_chosen_players
    )
    # A PC with no campaign: its player and the creator see its clocks.
    no_campaign = Q(campaign__isnull=True) & (
        Q(created_by_id=user.id) | Q(character__user_id=user.id)
    )
    keep = Q(campaign__gm_id=user.id) | as_player | no_campaign
    # A clock never shows an NPC from another campaign.
    return keep & (Q(npc__isnull=True) | Q(npc__campaign_id=F("campaign_id")))


def campaign_player_ids(campaign):
    """Users who can be picked to see a clock: the campaign's players."""
    if campaign is None:
        return set()
    ids = set(campaign.players.values_list("id", flat=True))
    ids.update(
        campaign.characters.values_list("user_id", flat=True).distinct()
    )
    ids.discard(campaign.gm_id)
    return ids


def can_change_visibility(user, clock):
    """The GM can change who sees any clock; a player only their own clocks."""
    campaign = getattr(clock, "campaign", None)
    if campaign is not None and campaign.gm_id == user.id:
        return True
    return clock.created_by_id is not None and clock.created_by_id == user.id
