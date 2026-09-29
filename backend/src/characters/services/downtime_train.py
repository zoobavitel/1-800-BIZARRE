"""
Downtime Train activity: mark 1 XP (or 2 with crew Training upgrade) on an
XP track. Once per track per downtime phase.

Trainable tracks: insight, prowess, resolve, playbook, heritage.
Heritage Train is intentional homebrew (SRD train list excludes Heritage).

Phase boundary: after the campaign's most recent COMPLETED Session
(``session_date``). Before the first completed score, a live session (if any)
bounds the phase to that session's start. With no completed score and no live
session, Train does not require a downtime session mode — tracks stay available.

Does not spend a downtime-activity budget — the app has no activity counter yet.
"""

from __future__ import annotations

from django.utils import timezone

from characters.models import Campaign, DowntimeActivity, Session

TRAINABLE_TRACKS = frozenset(
    {"insight", "prowess", "resolve", "playbook", "heritage"}
)

# Crew.upgrade_progress keys (frontend progressToUpgrades). BitD "personal"
# is Playbook Training. ``training_heritage`` is house-rule (not SRD).
TRACK_TO_TRAINING_UPGRADE = {
    "insight": "training_insight",
    "prowess": "training_prowess",
    "resolve": "training_resolve",
    "playbook": "training_personal",
    "heritage": "training_heritage",
}

_TRAIN_DESC_PREFIX = "train:"


class DowntimeTrainError(Exception):
    def __init__(self, message: str, *, code: str = "train_error"):
        super().__init__(message)
        self.message = message
        self.code = code


def train_description(track: str) -> str:
    return f"{_TRAIN_DESC_PREFIX}{track}"


def parse_train_track(description: str) -> str | None:
    raw = (description or "").strip().lower()
    if not raw.startswith(_TRAIN_DESC_PREFIX):
        return None
    track = raw[len(_TRAIN_DESC_PREFIX) :].strip()
    if track in TRAINABLE_TRACKS:
        return track
    return None


def _aware_dt(dt):
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _live_session_for_campaign(campaign_id):
    active_sid = (
        Campaign.objects.filter(pk=campaign_id)
        .values_list("active_session_id", flat=True)
        .first()
    )
    if not active_sid:
        return None
    return Session.objects.filter(pk=active_sid, campaign_id=campaign_id).first()


def downtime_phase_start(character):
    """Timezone-aware datetime when current downtime phase began, or None."""
    campaign_id = getattr(character, "campaign_id", None)
    if not campaign_id:
        return None

    sess = (
        Session.objects.filter(campaign_id=campaign_id, status="COMPLETED")
        .order_by("-session_date", "-id")
        .first()
    )
    if sess is not None and sess.session_date is not None:
        return _aware_dt(sess.session_date)

    # Before the first completed score, bound to the live session if one is running.
    live = _live_session_for_campaign(campaign_id)
    if live is not None and live.session_date is not None:
        return _aware_dt(live.session_date)

    return None


def tracks_trained_this_phase(character) -> list[str]:
    campaign_id = getattr(character, "campaign_id", None)
    start = downtime_phase_start(character)
    if (
        start is None
        and campaign_id is not None
        and not Session.objects.filter(
            campaign_id=campaign_id, status="COMPLETED"
        ).exists()
    ):
        # Open table time before any score finishes — no downtime session UI needed.
        return []

    qs = DowntimeActivity.objects.filter(
        character=character, activity_type="TRAIN"
    )
    if start is not None:
        qs = qs.filter(created_at__gte=start)
    found = []
    for desc in qs.values_list("description", flat=True):
        track = parse_train_track(desc)
        if track and track not in found:
            found.append(track)
    return found


def training_xp_amount(character, track: str) -> int:
    """1 XP base; 2 if crew has that track's Training upgrade."""
    key = TRACK_TO_TRAINING_UPGRADE.get(track)
    if not key:
        return 1
    crew = getattr(character, "crew", None)
    if crew is None:
        return 1
    progress = getattr(crew, "upgrade_progress", None) or {}
    if not isinstance(progress, dict):
        return 1
    return 2 if progress.get(key) else 1


def assert_can_train(character, track: str) -> None:
    key = str(track or "").strip().lower()
    if key not in TRAINABLE_TRACKS:
        raise DowntimeTrainError(
            "Train only Insight, Prowess, Resolve, Heritage, or Playbook.",
            code="invalid_track",
        )
    if key in tracks_trained_this_phase(character):
        raise DowntimeTrainError(
            f"Already trained {key} this downtime phase "
            "(once per track per phase).",
            code="already_trained",
        )


def record_train_activity(character, track: str, *, amount: int) -> DowntimeActivity:
    return DowntimeActivity.objects.create(
        character=character,
        activity_type="TRAIN",
        description=train_description(track),
        result=f"Marked {amount} XP on {track}",
        progress_made=amount,
    )
