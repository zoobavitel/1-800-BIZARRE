# This script has been replaced by get_user_token.py which accepts any username.
# Do not hardcode real usernames here. See SECURITY.md.
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

import sys

username = sys.argv[1] if len(sys.argv) > 1 else None
if not username:
    print("Usage: python get_user_token.py <username>")
    sys.exit(1)

try:
    user = User.objects.get(username=username)
    token, _ = Token.objects.get_or_create(user=user)
    print(f"Token for '{username}': {token.key}")
except User.DoesNotExist:
    print(f"User '{username}' not found.")
