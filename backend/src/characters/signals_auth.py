"""Sign out other devices when a user's password changes.

Any ``set_password()`` followed by ``save()`` deletes that user's knox login
tokens. This covers Account Settings, the Django admin, ``manage.py
changepassword`` and the repo's ``set_user_password`` command.

Django sets ``user._password`` in ``set_password()`` and clears it in
``save()`` only after the row is written, so ``post_save`` still sees it. A
hash upgrade on login (``check_password``) clears ``_password`` before saving,
so it does not count as a change.

A caller can keep one token (the device that made the change) by setting
``user._keep_auth_token_pk`` before saving.
"""

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from knox.models import AuthToken


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def revoke_tokens_on_password_change(sender, instance, created, **kwargs):
    if created or getattr(instance, "_password", None) is None:
        return
    tokens = AuthToken.objects.filter(user=instance)
    keep = getattr(instance, "_keep_auth_token_pk", None)
    if keep is not None:
        tokens = tokens.exclude(pk=keep)
    tokens.delete()
