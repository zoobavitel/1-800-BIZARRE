from characters.models import Character

print("All characters in the database:")
characters = Character.objects.all().order_by('id')
for char in characters:
    print(f"  ID: {char.id} - {char.true_name} (User: {char.user.username})")
    if char.campaign:
        print(f"    Campaign: {char.campaign.name}")
    else:
        print(f"    Campaign: None") 