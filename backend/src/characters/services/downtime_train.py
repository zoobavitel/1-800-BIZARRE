"""
Downtime Train activity: mark 1 XP (or 2 with crew Training upgrade) on an
attribute or playbook track. Once per track per downtime phase.

Phase boundary: after the campaign's most recent COMPLETED Session
(``session_date``). No completed session → any prior TRAIN for that track
still blocks (phase never auto-resets until a session completes).

Does not spend a downtime-activity budget — the app has no activity counter yet.
"""

from __future__ import annotations

from django.utils import timezone

from characters.models import DowntimeActivity, Session

TRAINABLE_TRACKS = frozenset({"insight", "prowess", "resolve", "playbook"})

# Crew.upgrade_progress keys (frontend progressToUpgrades). BitD "personal"
# is Playbook Training.
TRACK_TO_TRAINING_UPGRADE = {
    "insight": "training_insight",
    "prowess": "training_prowess",
    "resolve": "training_resolve",
    "playbook": "training_personal",
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


def downtime_phase_start(character):
    """Timezone-aware datetime when current downtime phase began, or None."""
    if not getattr(character, "campaign_id", None):
        return None
    sess = (
        Session.objects.filter(
            campaign_id=character.campaign_id, status="COMPLETED"
        )
        .order_by("-session_date", "-id")
        .first()
    )
    if sess is None or sess.session_date is None:
        return None
    dt = sess.session_date
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def tracks_trained_this_phase(character) -> list[str]:
    qs = DowntimeActivity.objects.filter(
        character=character, activity_type="TRAIN"
    )
    start = downtime_phase_start(character)
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
            "Train only Insight, Prowess, Resolve, or Playbook "
            "(Heritage cannot be trained).",
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
