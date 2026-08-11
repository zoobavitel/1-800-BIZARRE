"""Request-scoped context for attributing CharacterHistory rows to the acting user."""

import contextvars
from contextlib import contextmanager

_character_history_editor: contextvars.ContextVar = contextvars.ContextVar(
    "character_history_editor", default=None
)
_suppress_character_history: contextvars.ContextVar = contextvars.ContextVar(
    "suppress_character_history", default=False
)


def bind_character_history_editor(user):
    """Returns a token for reset()."""
    return _character_history_editor.set(user)


def reset_character_history_editor(token):
    _character_history_editor.reset(token)


def get_character_history_editor():
    return _character_history_editor.get()


def is_character_history_suppressed():
    return bool(_suppress_character_history.get())


@contextmanager
def suppress_character_history_logging():
    """Skip post_save CharacterHistory rows (e.g. when reverting a prior edit)."""
    token = _suppress_character_history.set(True)
    try:
        yield
    finally:
        _suppress_character_history.reset(token)
