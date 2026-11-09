"""Stash is personal; the crew has coin (user, 2026-11-03).

A PC in a crew used to keep its stash on the crew (Crew.stash_slots, shared
by every member). This copies each crew's grid into its members once, so
nobody loses boxes. A member whose own grid already has more filled boxes
keeps theirs.
"""

STASH_SIZE = 40


def _normalized(slots):
    out = [bool(x) for x in (slots if isinstance(slots, list) else [])]
    out += [False] * (STASH_SIZE - len(out))
    return out[:STASH_SIZE]


def copy_crew_stash_to_members(Crew, Character):
    """Return how many characters changed. Safe to run more than once."""
    changed = 0
    for crew in Crew.objects.all().only("id", "stash_slots"):
        crew_grid = _normalized(crew.stash_slots)
        crew_filled = sum(crew_grid)
        if crew_filled == 0:
            continue
        for pc in Character.objects.filter(crew_id=crew.id).only("id", "stash_slots"):
            if sum(_normalized(pc.stash_slots)) >= crew_filled:
                continue
            pc.stash_slots = crew_grid
            # update_fields keeps signals and version bumps out of a data copy.
            Character.objects.filter(pk=pc.pk).update(stash_slots=crew_grid)
            changed += 1
    return changed
