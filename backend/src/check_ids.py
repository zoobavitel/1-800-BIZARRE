from django.contrib.auth.models import User
from characters.models import Campaign, Character, NPC

try:
    zoob_user = User.objects.get(username="zoob")
    print(f"User 'zoob' ID: {zoob_user.id}")
except User.DoesNotExist:
    print("User 'zoob' not found.")

try:
    campaign = Campaign.objects.get(name="A History of Bad Men")
    print(f"Campaign 'A History of Bad Men' ID: {campaign.id}")
except Campaign.DoesNotExist:
    print("Campaign 'A History of Bad Men' not found.")

try:
    slick_rick = Character.objects.get(true_name="Slick Rick")
    print(f"Character 'Slick Rick' ID: {slick_rick.id}")
except Character.DoesNotExist:
    print("Character 'Slick Rick' not found.")

try:
    jack_rice = Character.objects.get(true_name="Jack Rice")
    print(f"Character 'Jack Rice' ID: {jack_rice.id}")
except Character.DoesNotExist:
    print("Character 'Jack Rice' not found.")

try:
    mf_doom = NPC.objects.get(name="MF DOOM")
    print(f"NPC 'MF DOOM' ID: {mf_doom.id}")
except NPC.DoesNotExist:
    print("NPC 'MF DOOM' not found.") 