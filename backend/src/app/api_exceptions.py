"""
DRF exception handler: add a single `message` string for clients while keeping
standard DRF keys (`detail`, field errors, `non_field_errors`).
"""

from __future__ import annotations

from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict) and "message" not in data:
        summary = _summarize_error_payload(data)
        if summary:
            out = dict(data)
            out["message"] = summary
            response.data = out
    elif isinstance(data, list) and data:
        response.data = {"message": str(data[0]), "errors": data}

    return response


def _summarize_error_payload(data: dict) -> str | None:
    if "detail" in data:
        d = data["detail"]
        if isinstance(d, str):
            return d
        if isinstance(d, list) and d:
            return str(d[0])
        return str(d)

    if "non_field_errors" in data:
        errs = data["non_field_errors"]
        if isinstance(errs, list) and errs:
            return str(errs[0])

    parts: list[str] = []
    for key, val in data.items():
        if key in ("detail", "message"):
            continue
        if isinstance(val, list) and val:
            parts.append(f"{key}: {val[0]}")
        elif isinstance(val, str):
            parts.append(f"{key}: {val}")
        elif val is not None:
            parts.append(f"{key}: {val}")

    return "; ".join(parts) if parts else None
