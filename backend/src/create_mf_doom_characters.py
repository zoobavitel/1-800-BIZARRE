from django.contrib.auth.models import User
from characters.models import Character, Stand, Heritage, Ability, Campaign, NPC

# 1. Find or Create User "zoob"
user_zoob, created = User.objects.get_or_create(username='zoob', defaults={'password': 'pbkdf2_sha256$600000$some_salt$some_hash', 'email': 'zoob@example.com'})
if created:
    print("Created user 'zoob'")
else:
    print("Using existing user 'zoob'")

# Get existing Heritage and Abilities for PC
heritage_human = Heritage.objects.get_or_create(name='Human', defaults={'base_hp': 0, 'description': 'A standard human heritage'})[0]
ability1 = Ability.objects.get_or_create(name='Standard Ability 1', defaults={'type': 'standard', 'description': 'A basic ability'})[0]
ability2 = Ability.objects.get_or_create(name='Standard Ability 2', defaults={'type': 'standard', 'description': 'Another basic ability'})[0]
ability3 = Ability.objects.get_or_create(name='Standard Ability 3', defaults={'type': 'standard', 'description': 'A third basic ability'})[0]

# 2. Create PC MF DOOM
pc_mf_doom = Character.objects.create(
    user=user_zoob,
    true_name='MF DOOM (PC)',
    heritage=heritage_human,
    action_dots={
        'hunt': 2, 'study': 1, 'survey': 1, 'tinker': 1,
        'finesse': 1, 'prowl': 1, 'skirmish': 0, 'wreck': 0,
        'attune': 0, 'command': 0, 'consort': 0, 'sway': 0,
    },
    stress=9,
    total_xp_spent=0,
    heritage_points_gained=0,
    stand_coin_points_gained=0,
    action_dice_gained=0,
)
pc_mf_doom.standard_abilities.add(ability1, ability2, ability3)

stand_pc_mf_doom = Stand.objects.create(
    character=pc_mf_doom,
    name='The Villain's Stand (PC)',
    type='FIGHTING',
    form='Humanoid',
    consciousness_level='C',
    power='C',
    speed='D',
    range='D',
    durability='C',
    precision='C',
    potential='C'
)

print(f"Created PC: {pc_mf_doom.true_name} (Level {pc_mf_doom.level})")
print(f"PC Stand: {stand_pc_mf_doom.name} (Power: {stand_pc_mf_doom.power}, Speed: {stand_pc_mf_doom.speed}, Durability: {stand_pc_mf_doom.durability}, Precision: {stand_pc_mf_doom.precision}, Range: {stand_pc_mf_doom.range}, Potential: {stand_pc_mf_doom.potential})")

# Create a default campaign for NPC if it doesn't exist
campaign_npc, created_campaign = Campaign.objects.get_or_create(name='NPC Default Campaign', defaults={'gm': user_zoob})
if created_campaign:
    print("Created 'NPC Default Campaign'")
else:
    print("Using existing 'NPC Default Campaign'")

# 3. Create NPC MF DOOM
npc_mf_doom = NPC.objects.create(
    creator=user_zoob,
    campaign=campaign_npc,
    name='MF DOOM (NPC)',
    level=10,
    appearance='A masked supervillain.',
    role='Master of Rhyme',
    weakness='Can be distracted by rare samples.',
    need='To maintain his mystique.',
    desire='To collect all the breaks.',
    rumour='He has many aliases.',
    secret='He secretly helps the needy.',
    passion='Crafting intricate rhymes.',
    description='The supervillain of the underground.',
    heritage=heritage_human,
    playbook='STAND',
    stand_name='MADVILLAINY',
    stand_coin_stats={
        'POWER': 'S',
        'SPEED': 'S',
        'RANGE': 'S',
        'DURABILITY': 'S',
        'PRECISION': 'S',
        'POTENTIAL': 'S'
    },
    harm_clock_current=0,
    vulnerability_clock_current=0,
    armor_charges=0,
)

print(f"Created NPC: {npc_mf_doom.name} (Level {npc_mf_doom.level})")
print(f"NPC Stand Stats: {npc_mf_doom.stand_coin_stats}")
