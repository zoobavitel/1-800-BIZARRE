"""
Custom parsers for Django REST Framework.
MultipartJsonParser parses JSON-encoded form fields (e.g. stand_coin_stats, abilities)
so they are properly deserialized when sending multipart/form-data with file uploads.
"""
import json
from django.http import QueryDict
from rest_framework import parsers


class MultipartJsonParser(parsers.MultiPartParser):
    """
    MultiPartParser that automatically parses JSON strings in form fields.
    DRF's default MultiPartParser leaves JSON fields as strings; this parser
    detects and parses them so JSONField values are correctly saved.

    Important: keep ``data`` as a QueryDict. A plain dict + ``Request.data``
    file merge turns uploaded files into lists, which FileField rejects with
    "The submitted data was not a file".
    """

    def parse(self, stream, media_type=None, parser_context=None):
        result = super().parse(
            stream, media_type=media_type, parser_context=parser_context
        )
        data = QueryDict("", mutable=True)
        for key, value in result.data.items():
            if not isinstance(value, str):
                data[key] = value
                continue
            stripped = value.strip()
            if (stripped.startswith("{") and stripped.endswith("}")) or (
                stripped.startswith("[") and stripped.endswith("]")
            ):
                try:
                    data[key] = json.loads(value)
                except (json.JSONDecodeError, ValueError):
                    data[key] = value
            else:
                data[key] = value
        return parsers.DataAndFiles(data, result.files)
