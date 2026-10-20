"""Fill PDF templates and optionally overlay character portraits."""

from __future__ import annotations

import io
import logging
import re
from pathlib import Path
from urllib.request import urlopen

from .deps import ensure_pdf_dependencies

logger = logging.getLogger(__name__)

# Portrait sits in a right-hand rail beside the Identity block (x, y, w, h in points).
# Form fields always draw on top of page content, so the box must not overlap
# any page-1 field. Identity fields end at x=482pt (PC) / 428pt (NPC); this box
# spans x=495-580pt. Top aligns with the "Identity" heading.
_PAGE_W, _PAGE_H, _MARGIN = 612, 792, 0.45 * 72
_PORTRAIT_W, _PORTRAIT_H = 85, 110
PORTRAIT_RECT = (
    _PAGE_W - _MARGIN - _PORTRAIT_W,
    _PAGE_H - _MARGIN - 22 + 9 - _PORTRAIT_H,
    _PORTRAIT_W,
    _PORTRAIT_H,
)


def sanitize_filename(name: str, fallback: str = "character") -> str:
    cleaned = re.sub(r"[^\w\s-]", "", name or "").strip().replace(" ", "-")
    return cleaned[:80] or fallback


def load_portrait_bytes(image_field, image_url: str = "") -> bytes | None:
    if image_field:
        try:
            with image_field.open("rb") as handle:
                return handle.read()
        except Exception:
            logger.exception("Failed to read uploaded portrait")
    url = (image_url or "").strip()
    if url:
        try:
            with urlopen(url, timeout=8) as resp:
                return resp.read()
        except Exception:
            logger.exception("Failed to fetch portrait URL")
    return None


def _overlay_portrait(pdf_bytes: bytes, portrait_bytes: bytes) -> bytes:
    ensure_pdf_dependencies()
    from PIL import Image
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    x, y, w, h = PORTRAIT_RECT
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    try:
        img = Image.open(io.BytesIO(portrait_bytes))
        img.thumbnail((int(w), int(h)), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        can.drawImage(
            ImageReader(buf),
            x,
            y,
            width=w,
            height=h,
            preserveAspectRatio=True,
            anchor="ne",
        )
    except Exception:
        logger.exception("Portrait overlay failed; returning PDF without image")
        return pdf_bytes
    can.save()
    packet.seek(0)

    # clone_from copies the whole document, AcroForm included, with proper
    # pypdf objects. Copying /AcroForm by hand with a plain str key crashed
    # writer.write() with "'str' object has no attribute 'write_to_stream'".
    reader = PdfReader(io.BytesIO(pdf_bytes))
    overlay_reader = PdfReader(packet)
    writer = PdfWriter(clone_from=reader)
    writer.pages[0].merge_page(overlay_reader.pages[0])

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def fill_pdf(
    template_path: Path,
    field_values: dict[str, str],
    portrait_bytes: bytes | None = None,
) -> bytes:
    ensure_pdf_dependencies()
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(template_path))
    writer = PdfWriter()
    writer.append(reader)

    for page in writer.pages:
        writer.update_page_form_field_values(page, field_values, auto_regenerate=False)

    try:
        writer.set_need_appearances_writer(True)
    except Exception:
        if "/AcroForm" in writer._root_object:
            writer._root_object["/AcroForm"].update({"/NeedAppearances": True})

    buffer = io.BytesIO()
    writer.write(buffer)
    pdf_bytes = buffer.getvalue()

    if portrait_bytes:
        pdf_bytes = _overlay_portrait(pdf_bytes, portrait_bytes)

    return pdf_bytes


def viewer_sees_everything(viewer, campaign) -> bool:
    """Staff and the campaign GM see hidden NPCs/factions. viewer=None is an
    internal call (tests, management commands) and also sees everything."""
    if viewer is None:
        return True
    if getattr(viewer, "is_staff", False):
        return True
    return bool(campaign is not None and campaign.gm_id == viewer.id)


def export_pc_pdf(character, viewer=None) -> tuple[bytes, str]:
    from characters.models import Character

    from .pc_builder import build_pc_field_values
    from .standing_crew_pages import (
        build_standing_crew_pdf_bytes,
        merge_pdf_bytes,
    )
    from .template_builder import ensure_templates

    ensure_pdf_dependencies()
    character = (
        Character.objects.select_related(
            "campaign", "crew", "crew__playbook", "heritage", "vice", "stand"
        )
        .prefetch_related(
            "standard_abilities",
            "hamon_abilities__hamon_ability",
            "spin_abilities__spin_ability",
            "selected_benefits",
            "selected_detriments",
            "progress_clocks",
            "stand__abilities",
            "crew__special_abilities",
            "crew__claims",
            "crew__faction_relationships__faction",
        )
        .get(pk=character.pk)
    )
    pc_path, _ = ensure_templates()
    field_values = build_pc_field_values(character)
    portrait = load_portrait_bytes(character.image, character.image_url)
    pdf_bytes = fill_pdf(pc_path, field_values, portrait_bytes=portrait)
    # A character sheet is the player's document: always the player view,
    # even when the GM exports it. viewer is accepted for API symmetry.
    append_bytes = build_standing_crew_pdf_bytes(character, player_view=True)
    pdf_bytes = merge_pdf_bytes(pdf_bytes, append_bytes)
    filename = f"{sanitize_filename(character.true_name, 'character')}-character-sheet.pdf"
    return pdf_bytes, filename


def export_npc_pdf(npc, viewer=None) -> tuple[bytes, str]:
    from .npc_builder import build_npc_field_values
    from .template_builder import ensure_templates

    ensure_pdf_dependencies()
    _, npc_path = ensure_templates()
    player_view = not viewer_sees_everything(viewer, npc.campaign)
    field_values = build_npc_field_values(npc, player_view=player_view)
    portrait = load_portrait_bytes(npc.image, npc.image_url)
    pdf_bytes = fill_pdf(npc_path, field_values, portrait_bytes=portrait)
    filename = f"{sanitize_filename(npc.name, 'npc')}-npc-sheet.pdf"
    return pdf_bytes, filename
