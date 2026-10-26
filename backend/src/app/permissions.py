"""Project-wide DRF permission classes."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaffOrReadOnly(BasePermission):
    """Anyone signed in may read; only staff may create, edit or delete.

    For the SRD catalogs (heritages, vices, abilities and the like). Players
    pick from these lists on their sheets, which writes the character, never
    the list itself. List edits come from staff, Django admin or management
    commands.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)
