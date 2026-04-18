"""Request-scoped context for attributing CharacterHistory rows to the acting user."""

import contextvars

_character_history_editor: contextvars.ContextVar = contextvars.ContextVar(
    "character_history_editor", default=None
)


def bind_character_history_editor(user):
    """Returns a token for reset()."""
    return _character_history_editor.set(user)


def reset_character_history_editor(token):
    _character_history_editor.reset(token)


def get_character_history_editor():
    return _character_history_editor.get()
