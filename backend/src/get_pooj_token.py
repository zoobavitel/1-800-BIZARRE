from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

try:
    # Get the user "pooj"
    pooj_user = User.objects.get(username="pooj")
    print(f"Found user: {pooj_user.username} (ID: {pooj_user.id})")
    
    # Get or create a token for this user
    token, created = Token.objects.get_or_create(user=pooj_user)
    
    if created:
        print(f"Created new token for user 'pooj'")
    else:
        print(f"Retrieved existing token for user 'pooj'")
    
    print(f"Token: {token.key}")
    print(f"Token created: {token.created}")
    
except User.DoesNotExist:
    print("User 'pooj' not found in the database.")
    print("\nAvailable users:")
    users = User.objects.all()
    for user in users:
        print(f"  - {user.username}") 