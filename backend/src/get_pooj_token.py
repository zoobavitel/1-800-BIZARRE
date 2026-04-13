# This script has been replaced by a generic token helper.
# Do not hardcode real usernames here. See SECURITY.md.
# Pass the username as the first argument: python get_pooj_token.py <username>
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

import sys

username = sys.argv[1] if len(sys.argv) > 1 else None
if not username:
    print("Usage: python get_pooj_token.py <username>")
    sys.exit(1)

try:
    user = User.objects.get(username=username)
    token, _ = Token.objects.get_or_create(user=user)
    print(f"Token for '{username}': {token.key}")
except User.DoesNotExist:
    print(f"User '{username}' not found.")
