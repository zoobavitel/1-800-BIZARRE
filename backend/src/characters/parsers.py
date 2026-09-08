"""
Custom parsers for Django REST Framework.
MultipartJsonParser parses JSON-encoded form fields (e.g. stand_coin_stats, abilities)
so they are properly deserialized when sending multipart/form-data with file uploads.
"""
import json
from django.http import QueryDict
from rest_framework import parsers


# DRF many=True PrimaryKeyRelatedField keys on Character/NPC multipart saves.
# These must use QueryDict.setlist so getlist returns flat pks.
# JSONField arrays of scalars (coin_boxes, playbook_xp_archetypes, …) must stay
# as JSON strings — setlist would make JSONField see a single element and fail
# with "Value must be valid JSON."
_M2M_PK_LIST_FIELDS = frozenset(
    {
        "standard_abilities",
        "hamon_ability_ids",
        "spin_ability_ids",
        "selected_benefits",
        "selected_detriments",
        "trauma",
    }
)


class MultipartJsonParser(parsers.MultiPartParser):
    """
    MultiPartParser that prepares JSON form fields for DRF.

    Keep ``data`` as a QueryDict so DRF's ``data.copy().update(files)`` merge
    still yields real file objects (a plain dict + MultiValueDict.update puts
    ``[file]`` lists into FileField and fails with "not a file").

    For known M2M pk-list fields, use ``setlist`` so DRF ``many=True`` fields
    see flat ids via getlist — not ``[[1, 2]]`` from ``QueryDict.__setitem__``.
    Leave all other JSON (objects and JSONField arrays) as strings so
    JSONField's HTML-input path can ``json.loads`` them.
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
                if key in _M2M_PK_LIST_FIELDS:
                    try:
                        parsed = json.loads(value)
                    except (json.JSONDecodeError, ValueError):
                        data[key] = value
                        continue
                    if isinstance(parsed, list):
                        data.setlist(
                            key, ["" if x is None else str(x) for x in parsed]
                        )
                    else:
                        data[key] = value
                else:
                    # JSONField / nested objects: keep raw JSON string.
                    data[key] = value
            else:
                data[key] = value
        return parsers.DataAndFiles(data, result.files)
