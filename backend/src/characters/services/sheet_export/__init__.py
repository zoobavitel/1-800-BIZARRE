"""Character and NPC sheet PDF export."""

from __future__ import annotations

from .pdf_fill import sanitize_filename

__all__ = ["export_pc_pdf", "export_npc_pdf", "sanitize_filename"]


def export_pc_pdf(character):
    from .pdf_fill import export_pc_pdf as _export_pc_pdf

    return _export_pc_pdf(character)


def export_npc_pdf(npc):
    from .pdf_fill import export_npc_pdf as _export_npc_pdf

    return _export_npc_pdf(npc)
