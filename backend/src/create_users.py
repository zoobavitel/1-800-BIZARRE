#!/usr/bin/env python
"""
Script to create test user accounts for the 1-800-BIZARRE platform.
Use generic placeholder usernames here – do not commit real player handles.
See SECURITY.md for guidelines.
"""

from django.contrib.auth.models import User

# List of usernames to create
usernames = [
    "test_player_1",
    "test_player_2",
    "test_player_3",
    "test_player_4",
    "test_player_5",
    "test_player_6",
    "test_player_7"
]

created_count = 0
skipped_count = 0

print("Creating test user accounts...")

for username in usernames:
    try:
        if User.objects.filter(username=username).exists():
            print(f'⚠️  User "{username}" already exists - skipping')
            skipped_count += 1
            continue

        user = User.objects.create_user(
            username=username,
            password=User.objects.make_random_password(),
            email=f"{username}@example.com"
        )

        print(f'✅ Created user "{username}"')
        created_count += 1

    except Exception as e:
        print(f'❌ Error creating user "{username}": {e}')

print("\n" + "="*50)
print("Summary:")
print(f"  • Created: {created_count} users")
print(f"  • Skipped: {skipped_count} users (already exist)")
print(f"  • Total processed: {len(usernames)} users")
print("="*50)
print("✨ User creation complete!")
