"""Human-readable PDF append pages: NPC Standing + Crew sheet."""

from __future__ import annotations

import io
from characters.models import Character, Crew, Faction, NPC


def _wrap_canvas():
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    return letter, c, buf


def _draw_wrapped(c, text: str, x: float, y: float, max_width: float, leading: float = 11):
    from reportlab.pdfbase.pdfmetrics import stringWidth

    words = (text or "").split()
    if not words:
        return y
    line = words[0]
    for w in words[1:]:
        trial = f"{line} {w}"
        if stringWidth(trial, "Helvetica", 9) <= max_width:
            line = trial
        else:
            c.drawString(x, y, line)
            y -= leading
            line = w
    c.drawString(x, y, line)
    return y - leading


def _standing_lines(character: Character, player_view: bool = False) -> list[str]:
    standing = character.npc_standing if isinstance(character.npc_standing, dict) else {}
    if not standing:
        return ["No NPC standing recorded."]

    npc_ids = []
    for key in standing.keys():
        try:
            npc_ids.append(int(key))
        except (TypeError, ValueError):
            continue
    names: dict[int, str] = {}
    if npc_ids and character.campaign_id:
        for npc in NPC.objects.filter(
            campaign_id=character.campaign_id, id__in=npc_ids
        ).only("id", "name", "visible_to_players"):
            if player_view and not npc.visible_to_players:
                continue
            names[npc.id] = (npc.name or f"NPC {npc.id}").strip()

    rows = []
    for key, raw in standing.items():
        try:
            nid = int(key)
        except (TypeError, ValueError):
            continue
        if player_view and nid not in names:
            # Hidden from players, or not an NPC in this campaign.
            continue
        try:
            val = int(raw)
        except (TypeError, ValueError):
            val = 0
        val = max(-3, min(3, val))
        label = names.get(nid) or f"NPC {nid}"
        sign = f"+{val}" if val > 0 else str(val)
        rows.append((label.lower(), f"{label} — standing {sign}"))
    rows.sort(key=lambda t: t[0])
    return [r[1] for r in rows] or ["No NPC standing recorded."]


def _player_faction_label(fac, rep_text: str) -> str | None:
    """How a player sees one faction row; None when the faction is hidden."""
    if not fac.visible_to_players:
        return None
    name = fac.name if fac.players_see_identity else "Unknown faction"
    rep = rep_text if fac.players_see_reputation else "hidden"
    return f"{name}: {rep}"


def _faction_rep_lines(character: Character, player_view: bool = False) -> list[str]:
    factions_by_name = {}
    if player_view and character.campaign_id:
        for fac in Faction.objects.filter(campaign_id=character.campaign_id):
            factions_by_name[(fac.name or "").strip().lower()] = fac
    lines = []

    def add(name: str, sign: str) -> None:
        fac = factions_by_name.get(name.lower()) if player_view else None
        if fac is None:
            lines.append(f"{name}: {sign}")
            return
        label = _player_faction_label(fac, sign)
        if label:
            lines.append(label)

    for src in (character.faction_reputation, character.reputation_status):
        if isinstance(src, list):
            for item in src:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or item.get("faction") or "").strip()
                if not name:
                    continue
                try:
                    rep = int(item.get("rep", item.get("reputation_value", 0)) or 0)
                except (TypeError, ValueError):
                    rep = 0
                sign = f"+{rep}" if rep > 0 else str(rep)
                add(name, sign)
        elif isinstance(src, dict):
            for name, rep in src.items():
                n = str(name).strip()
                if not n:
                    continue
                try:
                    v = int(rep)
                except (TypeError, ValueError):
                    v = 0
                sign = f"+{v}" if v > 0 else str(v)
                add(n, sign)
    # de-dupe preserve order
    seen = set()
    out = []
    for line in lines:
        if line in seen:
            continue
        seen.add(line)
        out.append(line)
    return out


def _crew_faction_lines(crew: Crew, player_view: bool = False) -> list[str]:
    rels = list(
        crew.faction_relationships.select_related("faction").order_by("faction__name")
    )
    if not rels:
        return ["No crew–faction reputation recorded."]
    out = []
    for rel in rels:
        name = (rel.faction.name if rel.faction_id else "Faction").strip()
        val = int(rel.reputation_value or 0)
        sign = f"+{val}" if val > 0 else str(val)
        if player_view and rel.faction_id:
            label = _player_faction_label(rel.faction, sign)
            if label:
                out.append(label)
            continue
        out.append(f"{name}: {sign}")
    return out or ["No crew–faction reputation recorded."]


def _crew_ability_lines(crew: Crew) -> list[str]:
    abs_ = list(crew.special_abilities.all().order_by("name"))
    if not abs_:
        return ["No crew special abilities."]
    out = []
    for ab in abs_:
        name = (ab.name or "Ability").strip()
        desc = (ab.description or "").strip()
        out.append(f"{name}: {desc}" if desc else name)
    return out


def _crew_upgrade_lines(crew: Crew) -> list[str]:
    prog = crew.upgrade_progress if isinstance(crew.upgrade_progress, dict) else {}
    claims = list(crew.claims.all().order_by("name"))
    lines = []
    for name, val in sorted(prog.items(), key=lambda kv: str(kv[0]).lower()):
        lines.append(f"{name}: {val}")
    for claim in claims:
        lines.append(f"Claim: {claim.name}")
    return lines or ["No upgrades or claims recorded."]


def build_standing_crew_pdf_bytes(character: Character, player_view: bool = False) -> bytes:
    """Return PDF bytes with Standing + Crew pages (no AcroForm).

    player_view drops NPCs and factions the GM has hidden from players.
    """
    ensure = __import__(
        "characters.services.sheet_export.deps", fromlist=["ensure_pdf_dependencies"]
    ).ensure_pdf_dependencies
    ensure()

    letter, c, buf = _wrap_canvas()
    PAGE_W, PAGE_H = letter
    MARGIN = 36
    max_w = PAGE_W - 2 * MARGIN

    # —— Standing page ——
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "NPC Standing & Faction Reputation")
    y -= 22
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN, y, "NPC Standing")
    y -= 14
    c.setFont("Helvetica", 9)
    for line in _standing_lines(character, player_view):
        if y < MARGIN + 40:
            c.showPage()
            y = PAGE_H - MARGIN
            c.setFont("Helvetica", 9)
        y = _draw_wrapped(c, line, MARGIN, y, max_w)
        y -= 2

    y -= 12
    if y < MARGIN + 60:
        c.showPage()
        y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGIN, y, "Faction Reputation (character)")
    y -= 14
    c.setFont("Helvetica", 9)
    fac_lines = _faction_rep_lines(character, player_view)
    if not fac_lines:
        fac_lines = ["No character faction reputation recorded."]
    for line in fac_lines:
        if y < MARGIN + 40:
            c.showPage()
            y = PAGE_H - MARGIN
            c.setFont("Helvetica", 9)
        y = _draw_wrapped(c, line, MARGIN, y, max_w)
        y -= 2

    c.showPage()

    # —— Crew page ——
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, y, "Crew Sheet")
    y -= 22
    c.setFont("Helvetica", 9)

    crew = character.crew if character.crew_id else None
    if crew is None:
        personal = (character.personal_crew_name or "").strip()
        msg = (
            f"Personal crew name: {personal}"
            if personal
            else "No crew linked."
        )
        c.drawString(MARGIN, y, msg)
        c.save()
        buf.seek(0)
        return buf.getvalue()

    def section(title: str):
        nonlocal y
        if y < MARGIN + 80:
            c.showPage()
            y = PAGE_H - MARGIN
        c.setFont("Helvetica-Bold", 10)
        c.drawString(MARGIN, y, title)
        y -= 14
        c.setFont("Helvetica", 9)

    section("Identity")
    y = _draw_wrapped(c, f"Name: {crew.name or ''}", MARGIN, y, max_w)
    if crew.playbook_id and crew.playbook:
        y = _draw_wrapped(
            c, f"Playbook: {crew.playbook.name}", MARGIN, y, max_w
        )
    if (crew.description or "").strip():
        y = _draw_wrapped(c, f"Description: {crew.description.strip()}", MARGIN, y, max_w)
    y -= 6

    section("Tracks")
    track_bits = [
        f"REP {int(crew.rep or 0)}/6",
        f"TURF {int(crew.turf or 0)}/6",
        f"TIER {int(crew.level or 0)}/4",
        f"WANTED {int(crew.wanted_level or 0)}/5",
        f"COIN {int(crew.coin or 0)}/4",
        f"HOLD {(crew.hold or 'weak').upper()}",
    ]
    y = _draw_wrapped(c, " · ".join(track_bits), MARGIN, y, max_w)
    y = _draw_wrapped(
        c,
        f"Crew XP: {int(crew.xp or 0)}/{int(crew.xp_track_size or 8)} · "
        f"Advancement points: {int(crew.advancement_points or 0)}",
        MARGIN,
        y,
        max_w,
    )
    stash = crew.stash_slots if isinstance(crew.stash_slots, list) else []
    filled_stash = sum(1 for s in stash if s)
    y = _draw_wrapped(
        c,
        f"Stash filled: {filled_stash}/{len(stash) or 40} (also on page 1 when linked)",
        MARGIN,
        y,
        max_w,
    )
    y -= 6

    section("Special Abilities")
    for line in _crew_ability_lines(crew):
        if y < MARGIN + 40:
            c.showPage()
            y = PAGE_H - MARGIN
            c.setFont("Helvetica", 9)
        y = _draw_wrapped(c, f"• {line}", MARGIN, y, max_w)
        y -= 2
    y -= 6

    section("Upgrades & Claims")
    for line in _crew_upgrade_lines(crew):
        if y < MARGIN + 40:
            c.showPage()
            y = PAGE_H - MARGIN
            c.setFont("Helvetica", 9)
        y = _draw_wrapped(c, f"• {line}", MARGIN, y, max_w)
        y -= 2
    y -= 6

    section("Faction Reputation (crew)")
    for line in _crew_faction_lines(crew, player_view):
        if y < MARGIN + 40:
            c.showPage()
            y = PAGE_H - MARGIN
            c.setFont("Helvetica", 9)
        y = _draw_wrapped(c, f"• {line}", MARGIN, y, max_w)
        y -= 2
    y -= 6

    notes = (crew.notes or "").strip()
    section("Notes")
    y = _draw_wrapped(c, notes or "(none)", MARGIN, y, max_w)

    if crew.image_url or (crew.image and getattr(crew.image, "name", None)):
        y -= 8
        section("Portrait")
        src = crew.image_url or (crew.image.name if crew.image else "")
        y = _draw_wrapped(c, f"Image: {src}", MARGIN, y, max_w)

    c.save()
    buf.seek(0)
    return buf.getvalue()


def merge_pdf_bytes(base_pdf: bytes, append_pdf: bytes) -> bytes:
    """Append append_pdf pages onto base_pdf, preserving AcroForm when present."""
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    base = PdfReader(io.BytesIO(base_pdf))
    writer.append(base)
    writer.append(PdfReader(io.BytesIO(append_pdf)))
    try:
        writer.set_need_appearances_writer(True)
    except Exception:
        pass
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
