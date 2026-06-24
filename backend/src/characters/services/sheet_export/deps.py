"""Optional PDF export dependencies (pypdf, reportlab)."""

from __future__ import annotations

INSTALL_HINT = (
    "PDF export requires pypdf and reportlab. "
    "From the repo root with your venv active, run: "
    "pip install -r backend/requirements.txt"
)


def ensure_pdf_dependencies() -> None:
    """Raise ImportError with install instructions when PDF libs are missing."""
    missing: list[str] = []
    try:
        import pypdf  # noqa: F401
    except ImportError:
        missing.append("pypdf")
    try:
        import reportlab  # noqa: F401
    except ImportError:
        missing.append("reportlab")
    if missing:
        raise ImportError(f"{INSTALL_HINT} (missing: {', '.join(missing)})")
