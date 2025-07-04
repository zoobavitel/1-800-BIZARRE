from django.contrib.auth.models import User
from characters.models import Character
from django.db.models import Count

def find_duplicate_characters():
    # Find users with more than one character
    users_with_multiple_characters = User.objects.annotate(
        character_count=Count('character')
    ).filter(character_count__gt=1)

    if not users_with_multiple_characters:
        print("No users with duplicate characters found.")
        return

    print("Users with duplicate characters:")
    for user in users_with_multiple_characters:
        print(f"\nUser: {user.username} (ID: {user.id}) has {user.character_count} characters:")
        characters = Character.objects.filter(user=user)
        for char in characters:
            print(
                f"  - Character ID: {char.id}, Name: '{char.true_name}', "
                f"Alias: '{char.alias}', Heritage: {char.heritage.name if char.heritage else 'N/A'}"
            )

find_duplicate_characters()