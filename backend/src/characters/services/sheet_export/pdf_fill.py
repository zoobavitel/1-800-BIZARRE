"""Fill PDF templates and optionally overlay character portraits."""

from __future__ import annotations

import io
import logging
import re
from pathlib import Path
from typing import BinaryIO
from urllib.request import urlopen

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .template_builder import ensure_templates

logger = logging.getLogger(__name__)

PAGE_W, PAGE_H = letter
PORTRAIT_RECT = (0.45 * 72, 620, 90, 110)  # x, y, w, h in points (approx top-left)


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
    x, y, w, h = PORTRAIT_RECT
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    try:
        img = Image.open(io.BytesIO(portrait_bytes))
        img.thumbnail((int(w), int(h)), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        can.drawImage(ImageReader(buf), x, y, width=w, height=h, preserveAspectRatio=True, anchor="sw")
    except Exception:
        logger.exception("Portrait overlay failed; returning PDF without image")
        return pdf_bytes
    can.save()
    packet.seek(0)

    reader = PdfReader(io.BytesIO(pdf_bytes))
    overlay_reader = PdfReader(packet)
    writer = PdfWriter()
    for page_index, page in enumerate(reader.pages):
        if page_index == 0:
            page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)

    if reader.trailer.get("/Root", {}).get("/AcroForm"):
        writer._root_object.update(
            {"/AcroForm": reader.trailer["/Root"]["/AcroForm"]}
        )

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def fill_pdf(
    template_path: Path,
    field_values: dict[str, str],
    portrait_bytes: bytes | None = None,
) -> bytes:
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


def export_pc_pdf(character) -> tuple[bytes, str]:
    from .pc_builder import build_pc_field_values

    pc_path, _ = ensure_templates()
    field_values = build_pc_field_values(character)
    portrait = load_portrait_bytes(character.image, character.image_url)
    pdf_bytes = fill_pdf(pc_path, field_values, portrait_bytes=portrait)
    filename = f"{sanitize_filename(character.true_name, 'character')}-character-sheet.pdf"
    return pdf_bytes, filename


def export_npc_pdf(npc) -> tuple[bytes, str]:
    from .npc_builder import build_npc_field_values

    _, npc_path = ensure_templates()
    field_values = build_npc_field_values(npc)
    portrait = load_portrait_bytes(npc.image, npc.image_url)
    pdf_bytes = fill_pdf(npc_path, field_values, portrait_bytes=portrait)
    filename = f"{sanitize_filename(npc.name, 'npc')}-npc-sheet.pdf"
    return pdf_bytes, filename
