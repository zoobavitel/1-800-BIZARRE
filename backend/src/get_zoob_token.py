from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

try:
    # Get the user "zoob"
    zoob_user = User.objects.get(username="zoob")
    print(f"Found user: {zoob_user.username} (ID: {zoob_user.id})")
    
    # Get or create a token for this user
    token, created = Token.objects.get_or_create(user=zoob_user)
    
    if created:
        print(f"Created new token for user 'zoob'")
    else:
        print(f"Retrieved existing token for user 'zoob'")
    
    print(f"Token: {token.key}")
    print(f"Token created: {token.created}")
    
except User.DoesNotExist:
    print("User 'zoob' not found in the database.")
    print("\nAvailable users:")
    users = User.objects.all()
    for user in users:
        print(f"  - {user.username}") 