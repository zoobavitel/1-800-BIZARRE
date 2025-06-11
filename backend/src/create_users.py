#!/usr/bin/env python
"""
Script to create test user accounts for the JOJO TTRPG platform
"""

from django.contrib.auth.models import User

# List of usernames to create
usernames = [
    "alecb100",
    "cnlp", 
    "dom",
    "robb",
    "pooj",
    "b1rd",
    "souza"
]

password = "1234"
created_count = 0
skipped_count = 0

print("Creating test user accounts...")

for username in usernames:
    try:
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            print(f'⚠️  User "{username}" already exists - skipping')
            skipped_count += 1
            continue
        
        # Create new user
        user = User.objects.create_user(
            username=username,
            password=password,
            email=f"{username}@example.com"
        )
        
        print(f'✅ Created user "{username}" with password "{password}"')
        created_count += 1
        
    except Exception as e:
        print(f'❌ Error creating user "{username}": {e}')

# Summary
print("\n" + "="*50)
print("Summary:")
print(f"  • Created: {created_count} users")
print(f"  • Skipped: {skipped_count} users (already exist)")
print(f"  • Total processed: {len(usernames)} users")

if created_count > 0:
    print(f'\n🔑 All new users have password: "{password}"')

print("="*50)
print("✨ User creation complete!")
