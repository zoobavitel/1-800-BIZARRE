"""Build fillable PDF templates for PC and NPC character sheets."""

from __future__ import annotations

from pathlib import Path

from .deps import ensure_pdf_dependencies
from .field_maps import (
    ACTION_KEYS,
    MAX_CLOCK_SEGMENTS,
    MAX_COIN_BOXES,
    MAX_HEALING_SEGMENTS,
    MAX_STASH_SLOTS,
    MAX_STRESS_SLOTS,
    MAX_XP_PER_TRACK,
    MAX_XP_PLAYBOOK_TRACK,
    TRAUMA_KEYS,
    XP_TRACK_KEYS,
    xp_track_max_segments,
)


def _canvas_for_template(output_path: Path):
    ensure_pdf_dependencies()
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas

    return letter, inch, canvas.Canvas(str(output_path), pagesize=letter)


def _section_title(c: canvas.Canvas, title: str, x: float, y: float) -> None:
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y, title)


def _add_text_field(form, name: str, x: float, y: float, w: float, h: float = 14) -> None:
    form.textfield(
        name=name,
        tooltip=name,
        x=x,
        y=y,
        width=w,
        height=h,
        borderStyle="underlined",
        forceBorder=True,
        fontSize=8,
    )


def _add_checkbox(form, name: str, x: float, y: float, size: float = 10) -> None:
    form.checkbox(
        name=name,
        tooltip=name,
        x=x,
        y=y,
        size=size,
        borderStyle="solid",
        forceBorder=True,
    )


def _checkbox_row(
    form,
    prefix: str,
    count: int,
    x: float,
    y: float,
    spacing: float = 12,
) -> None:
    for i in range(count):
        _add_checkbox(form, f"{prefix}{i}", x + i * spacing, y)


def build_pc_template(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    letter_size, inch, c = _canvas_for_template(output_path)
    PAGE_W, PAGE_H = letter_size
    MARGIN = 0.45 * inch
    form = c.acroForm

    # Page 1 header
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, PAGE_H - MARGIN, "1(800)BIZARRE — Character Sheet")
    y = PAGE_H - MARGIN - 22

    _section_title(c, "Identity", MARGIN, y)
    y -= 16
    _add_text_field(form, "pc_name", MARGIN, y - 2, 2.2 * inch)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN, y - 12, "Name")
    _add_text_field(form, "pc_stand_name", MARGIN + 2.35 * inch, y - 2, 2.0 * inch)
    c.drawString(MARGIN + 2.35 * inch, y - 12, "Stand Name")
    _add_text_field(form, "pc_crew", MARGIN + 4.55 * inch, y - 2, 1.55 * inch)
    c.drawString(MARGIN + 4.55 * inch, y - 12, "Crew")
    y -= 28
    _add_text_field(form, "pc_look", MARGIN, y - 2, 3.2 * inch)
    c.drawString(MARGIN, y - 12, "Look")
    _add_text_field(form, "pc_heritage", MARGIN + 3.35 * inch, y - 2, 1.2 * inch)
    c.drawString(MARGIN + 3.35 * inch, y - 12, "Heritage")
    _add_text_field(form, "pc_vice", MARGIN + 4.65 * inch, y - 2, 1.45 * inch)
    c.drawString(MARGIN + 4.65 * inch, y - 12, "Vice")
    y -= 28
    _add_text_field(form, "pc_background", MARGIN, y - 2, 3.2 * inch)
    c.drawString(MARGIN, y - 12, "Background")
    _add_text_field(form, "pc_campaign", MARGIN + 3.35 * inch, y - 2, 2.75 * inch)
    c.drawString(MARGIN + 3.35 * inch, y - 12, "Campaign")
    y -= 28
    _add_text_field(form, "pc_playbook", MARGIN, y - 2, 1.2 * inch)
    c.drawString(MARGIN, y - 12, "Playbook")
    _add_text_field(form, "pc_playbook_archetypes", MARGIN + 1.35 * inch, y - 2, 4.75 * inch)
    c.drawString(MARGIN + 1.35 * inch, y - 12, "Playbook XP Archetypes")

    col2 = MARGIN + 4.0 * inch
    col3 = MARGIN + 5.4 * inch
    y_top = PAGE_H - MARGIN - 22 - 120

    _section_title(c, "Stand Coin", col2, y_top)
    stat_y = y_top - 14
    for stat in ("power", "speed", "range", "durability", "precision", "development"):
        c.setFont("Helvetica", 7)
        c.drawString(col2, stat_y, stat.title())
        _add_text_field(form, f"pc_stand_{stat}", col2 + 0.75 * inch, stat_y - 2, 0.35 * inch, 12)
        stat_y -= 16

    _section_title(c, "Action Ratings", col3, y_top)
    act_y = y_top - 14
    for action in ACTION_KEYS:
        c.setFont("Helvetica", 7)
        c.drawString(col3, act_y, action.upper())
        _add_text_field(form, f"pc_action_{action}", col3 + 0.85 * inch, act_y - 2, 0.25 * inch, 12)
        act_y -= 13

    y = PAGE_H - MARGIN - 210
    _section_title(c, "Stress", MARGIN, y)
    _checkbox_row(form, "pc_stress_", MAX_STRESS_SLOTS, MARGIN, y - 14)
    y -= 32
    _section_title(c, "Trauma", MARGIN, y)
    tx = MARGIN
    for key in TRAUMA_KEYS:
        c.setFont("Helvetica", 7)
        c.drawString(tx, y - 12, key.title())
        _add_checkbox(form, f"pc_trauma_{key}", tx, y - 24)
        tx += 0.75 * inch

    y -= 42
    _section_title(c, "Harm", MARGIN, y)
    harm_y = y - 14
    for level, field in (
        ("4", "pc_harm_l4"),
        ("3", "pc_harm_l3"),
        ("2", "pc_harm_l2"),
        ("2b", "pc_harm_l2_slot2"),
        ("1", "pc_harm_l1"),
        ("1b", "pc_harm_l1_slot2"),
    ):
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN, harm_y, f"Level {level}")
        _add_text_field(form, field, MARGIN + 0.55 * inch, harm_y - 2, 5.5 * inch)
        harm_y -= 16

    y -= 110
    _section_title(c, "Healing Clock", MARGIN, y)
    _checkbox_row(form, "pc_healing_", MAX_HEALING_SEGMENTS, MARGIN, y - 14, spacing=14)

    _section_title(c, "Armor Uses", MARGIN + 2.5 * inch, y)
    _add_text_field(form, "pc_armor_stand", MARGIN + 2.5 * inch, y - 16, 1.6 * inch)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN + 2.5 * inch, y - 28, "Stand armor (used/max)")
    _add_text_field(form, "pc_armor_physical", MARGIN + 4.3 * inch, y - 16, 1.6 * inch)
    c.drawString(MARGIN + 4.3 * inch, y - 28, "Physical gear (used/max)")

    y -= 48
    _section_title(c, "Coin", MARGIN, y)
    _checkbox_row(form, "pc_coin_", MAX_COIN_BOXES, MARGIN, y - 14, spacing=14)
    _section_title(c, "Stash", MARGIN + 1.2 * inch, y)
    _checkbox_row(form, "pc_stash_", MAX_STASH_SLOTS, MARGIN + 1.2 * inch, y - 14, spacing=10)

    y -= 36
    _section_title(c, "XP Tracks", MARGIN, y)
    xp_x = MARGIN
    for track in XP_TRACK_KEYS:
        max_segments = xp_track_max_segments(track)
        spacing = 8 if track == "playbook" else 10
        c.setFont("Helvetica", 7)
        label = "Playbook (10)" if track == "playbook" else track.title()
        c.drawString(xp_x, y - 10, label)
        _checkbox_row(
            form,
            f"pc_xp_{track}_",
            max_segments,
            xp_x,
            y - 22,
            spacing=spacing,
        )
        xp_x += 1.15 * inch if track != "playbook" else 1.25 * inch
    _add_text_field(form, "pc_unallocated_xp", MARGIN + 5.8 * inch, y - 18, 0.8 * inch, 12)
    c.drawString(MARGIN + 5.8 * inch, y - 10, "Pool")

    y -= 52
    _section_title(c, "Progress Clocks (fill blank rows in play)", MARGIN, y)
    clock_y = y - 14
    for idx in range(1, 5):
        _add_text_field(form, f"pc_clock_{idx}_name", MARGIN, clock_y - 2, 1.6 * inch)
        _checkbox_row(
            form,
            f"pc_clock_{idx}_seg_",
            MAX_CLOCK_SEGMENTS,
            MARGIN + 1.75 * inch,
            clock_y - 2,
            spacing=12,
        )
        clock_y -= 18

    y -= 90
    _section_title(c, "Abilities (core)", MARGIN, y)
    _add_text_field(form, "pc_abilities", MARGIN, y - 70, 6.2 * inch, 68)

    c.showPage()

    # Page 2 overflow
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN, PAGE_H - MARGIN, "Character Sheet — Overflow")
    y2 = PAGE_H - MARGIN - 24
    _section_title(c, "Additional Abilities", MARGIN, y2)
    _add_text_field(form, "pc_abilities_overflow", MARGIN, y2 - 90, 6.5 * inch, 88)
    y2 -= 110
    _section_title(c, "Heritage Benefits & Detriments", MARGIN, y2)
    _add_text_field(form, "pc_heritage_picks", MARGIN, y2 - 50, 6.5 * inch, 48)
    y2 -= 70
    _section_title(c, "Inventory", MARGIN, y2)
    _add_text_field(form, "pc_inventory", MARGIN, y2 - 90, 6.5 * inch, 88)
    y2 -= 110
    _section_title(c, "Notes", MARGIN, y2)
    _add_text_field(form, "pc_notes", MARGIN, y2 - 120, 6.5 * inch, 118)

    c.save()


def build_npc_template(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    letter_size, inch, c = _canvas_for_template(output_path)
    PAGE_W, PAGE_H = letter_size
    MARGIN = 0.45 * inch
    form = c.acroForm

    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, PAGE_H - MARGIN, "1(800)BIZARRE — NPC Sheet")
    y = PAGE_H - MARGIN - 22

    _section_title(c, "Identity", MARGIN, y)
    y -= 16
    _add_text_field(form, "npc_name", MARGIN, y - 2, 2.0 * inch)
    _add_text_field(form, "npc_stand_name", MARGIN + 2.1 * inch, y - 2, 1.8 * inch)
    _add_text_field(form, "npc_role", MARGIN + 4.0 * inch, y - 2, 1.5 * inch)
    y -= 28
    _add_text_field(form, "npc_look", MARGIN, y - 2, 3.0 * inch)
    c.drawString(MARGIN, y - 12, "Look")
    _add_text_field(form, "npc_heritage", MARGIN + 3.1 * inch, y - 2, 1.2 * inch)
    c.drawString(MARGIN + 3.1 * inch, y - 12, "Heritage")
    _add_text_field(form, "npc_playbook", MARGIN + 4.4 * inch, y - 2, 1.0 * inch)
    c.drawString(MARGIN + 4.4 * inch, y - 12, "Playbook")
    y -= 28
    _add_text_field(form, "npc_campaign", MARGIN, y - 2, 2.5 * inch)
    c.drawString(MARGIN, y - 12, "Campaign")
    _add_text_field(form, "npc_faction", MARGIN + 2.6 * inch, y - 2, 2.9 * inch)
    c.drawString(MARGIN + 2.6 * inch, y - 12, "Faction")

    col2 = MARGIN + 4.0 * inch
    y_top = PAGE_H - MARGIN - 22 - 90
    _section_title(c, "Stand Coin", col2, y_top)
    stat_y = y_top - 14
    for stat in ("power", "speed", "range", "durability", "precision", "development"):
        c.setFont("Helvetica", 7)
        c.drawString(col2, stat_y, stat.title())
        _add_text_field(form, f"npc_stand_{stat}", col2 + 0.75 * inch, stat_y - 2, 0.35 * inch, 12)
        stat_y -= 16

    y = PAGE_H - MARGIN - 170
    _section_title(c, "Vulnerability Clock", MARGIN, y)
    _add_text_field(form, "npc_vulnerability", MARGIN, y - 16, 1.2 * inch)
    _checkbox_row(form, "npc_vuln_seg_", MAX_CLOCK_SEGMENTS, MARGIN + 1.35 * inch, y - 14)

    y -= 36
    for label, field in (
        ("Regular armor", "npc_armor_regular"),
        ("Stand armor", "npc_armor_stand"),
        ("Special armor", "npc_armor_special"),
        ("Physical gear", "npc_armor_physical"),
    ):
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN, y, label)
        _add_text_field(form, field, MARGIN + 1.1 * inch, y - 2, 1.4 * inch)
        y -= 18

    y -= 8
    _section_title(c, "Progress / Conflict Clocks", MARGIN, y)
    clock_y = y - 14
    for idx in range(1, 5):
        _add_text_field(form, f"npc_clock_{idx}_name", MARGIN, clock_y - 2, 1.6 * inch)
        _checkbox_row(
            form,
            f"npc_clock_{idx}_seg_",
            MAX_CLOCK_SEGMENTS,
            MARGIN + 1.75 * inch,
            clock_y - 2,
            spacing=12,
        )
        clock_y -= 18

    y -= 90
    narrative = (
        ("Weakness", "npc_weakness"),
        ("Need", "npc_need"),
        ("Desire", "npc_desire"),
        ("Rumour", "npc_rumour"),
        ("Secret", "npc_secret"),
        ("Passion", "npc_passion"),
    )
    for label, field in narrative:
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN, y, label)
        _add_text_field(form, field, MARGIN + 0.75 * inch, y - 2, 5.5 * inch)
        y -= 18

    y -= 6
    _section_title(c, "Abilities", MARGIN, y)
    _add_text_field(form, "npc_abilities", MARGIN, y - 70, 6.2 * inch, 68)

    c.showPage()

    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN, PAGE_H - MARGIN, "NPC Sheet — Overflow")
    y2 = PAGE_H - MARGIN - 24
    _section_title(c, "Description & Stand", MARGIN, y2)
    for label, field in (
        ("Description", "npc_description"),
        ("Stand Description", "npc_stand_description"),
        ("Stand Appearance", "npc_stand_appearance"),
        ("Manifestation", "npc_stand_manifestation"),
        ("Special Traits", "npc_special_traits"),
    ):
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN, y2, label)
        _add_text_field(form, field, MARGIN, y2 - 16, 6.5 * inch, 14)
        y2 -= 24
    y2 -= 8
    _section_title(c, "Additional Abilities", MARGIN, y2)
    _add_text_field(form, "npc_abilities_overflow", MARGIN, y2 - 60, 6.5 * inch, 58)
    y2 -= 78
    _section_title(c, "Inventory & Notes", MARGIN, y2)
    _add_text_field(form, "npc_inventory", MARGIN, y2 - 40, 6.5 * inch, 38)
    _add_text_field(form, "npc_inventory_notes", MARGIN, y2 - 58, 6.5 * inch, 16)
    _add_text_field(form, "npc_notes", MARGIN, y2 - 90, 6.5 * inch, 30)
    y2 -= 110
    _section_title(c, "Contacts & Relationships", MARGIN, y2)
    _add_text_field(form, "npc_contacts", MARGIN, y2 - 40, 3.1 * inch, 38)
    _add_text_field(form, "npc_relationships", MARGIN + 3.25 * inch, y2 - 40, 3.25 * inch, 38)
    _add_text_field(form, "npc_faction_status", MARGIN, y2 - 70, 6.5 * inch, 26)

    c.save()


def templates_dir() -> Path:
    return Path(__file__).resolve().parent / "templates"


def ensure_templates() -> tuple[Path, Path]:
    """Build templates if missing (e.g. fresh checkout)."""
    tdir = templates_dir()
    pc_path = tdir / "pc_sheet_template.pdf"
    npc_path = tdir / "npc_sheet_template.pdf"
    if not pc_path.exists():
        build_pc_template(pc_path)
    if not npc_path.exists():
        build_npc_template(npc_path)
    return pc_path, npc_path


def build_all_templates() -> None:
    tdir = templates_dir()
    build_pc_template(tdir / "pc_sheet_template.pdf")
    build_npc_template(tdir / "npc_sheet_template.pdf")
