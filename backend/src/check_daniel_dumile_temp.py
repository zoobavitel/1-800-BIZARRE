
from characters.models import NPC

try:
    npc = NPC.objects.get(name='Daniel Dumile')
    print(f"Found NPC: {npc.name} (ID: {npc.id})")
except NPC.DoesNotExist:
    print("NPC 'Daniel Dumile' not found.")
