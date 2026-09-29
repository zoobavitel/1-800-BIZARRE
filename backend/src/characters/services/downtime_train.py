"""
Train: mark 1 XP (or 2 with crew Training upgrade) on an XP track.
Repeatable anytime on any track — no session or phase limits.

Trainable tracks: insight, prowess, resolve, playbook, heritage.
Heritage Train is intentional homebrew (SRD train list excludes Heritage).
"""

from __future__ import annotations

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


class DowntimeTrainError(Exception):
    def __init__(self, message: str, *, code: str = "train_error"):
        super().__init__(message)
        self.message = message
        self.code = code


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
