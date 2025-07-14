from django.contrib.auth.models import User
from characters.models import Character, NPC, Crew, Heritage, XPHistory, StressHistory, ChatMessage

print("=== DUPLICATION ANALYSIS REPORT ===\n")

# 1. Check for duplicate heritage entries
print("1. HERITAGE DUPLICATES:")
heritages = Heritage.objects.all().order_by('name')
heritage_names = {}
for heritage in heritages:
    if heritage.name in heritage_names:
        print(f"   DUPLICATE: '{heritage.name}' - IDs: {heritage_names[heritage.name]}, {heritage.id}")
    else:
        heritage_names[heritage.name] = heritage.id

# 2. Check for duplicate model instances
print("\n2. DUPLICATE MODEL INSTANCES:")
print("   XPHistory models:", XPHistory.objects.count())
print("   StressHistory models:", StressHistory.objects.count())
print("   ChatMessage models:", ChatMessage.objects.count())

# 3. Check for users with multiple characters
print("\n3. USERS WITH MULTIPLE CHARACTERS:")
from django.db.models import Count
users_with_multiple = User.objects.annotate(
    char_count=Count('character')
).filter(char_count__gt=1)

for user in users_with_multiple:
    print(f"   User '{user.username}' has {user.char_count} characters")

# 4. Check for characters with same names
print("\n4. CHARACTERS WITH SAME NAMES:")
character_names = {}
for char in Character.objects.all():
    if char.true_name in character_names:
        print(f"   DUPLICATE NAME: '{char.true_name}' - IDs: {character_names[char.true_name]}, {char.id}")
    else:
        character_names[char.true_name] = char.id

# 5. Check for NPCs with same names
print("\n5. NPCS WITH SAME NAMES:")
npc_names = {}
for npc in NPC.objects.all():
    if npc.name in npc_names:
        print(f"   DUPLICATE NAME: '{npc.name}' - IDs: {npc_names[npc.name]}, {npc.id}")
    else:
        npc_names[npc.name] = npc.id

print("\n=== END REPORT ===") 