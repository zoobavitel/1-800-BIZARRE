from django.contrib.auth.models import User
from characters.models import (
    Character, Heritage, Ability, HamonAbility, SpinAbility, Benefit, Detriment, Vice,
    CharacterHamonAbility, CharacterSpinAbility
)

def create_test_characters():
    # Get or create the user for these characters
    user, created = User.objects.get_or_create(username='test_character_user')
    if created:
        user.set_password('test')
        user.save()
        print("Created user 'test_character_user'")

    # Clean up previous test characters for this user to avoid duplicates
    Character.objects.filter(user=user).delete()
    print("Cleared previous test characters for 'test_character_user'.")

    # Character 1: Stand User
    human_heritage = Heritage.objects.get(name='Human')
    stand_user = Character.objects.create(
        user=user,
        true_name='Standy - Level 1 Character Test',
        alias='Standy',
        heritage=human_heritage,
        playbook='STAND',
        coin_stats={'power': 'B', 'speed': 'B', 'range': 'C', 'durability': 'C', 'precision': 'F', 'development': 'F'},
        custom_ability_type='three_separate_uses',
        extra_custom_abilities=[
            {'name': 'Custom Ability 1', 'description': 'Description for custom ability 1'},
            {'name': 'Custom Ability 2', 'description': 'Description for custom ability 2'}
        ]
    )
    stand_user.standard_abilities.add(Ability.objects.get(name='Iron Will'))
    print("Created Stand User character.")

    # Character 2: Spin User
    cyborg_heritage = Heritage.objects.get(name='Cyborg')
    spin_user = Character.objects.create(
        user=user,
        true_name='Spiny - Level 1 Character Test',
        alias='Spiny',
        heritage=cyborg_heritage,
        playbook='SPIN',
        coin_stats={'power': 'A', 'speed': 'C', 'range': 'C', 'durability': 'D', 'precision': 'D', 'development': 'F'}
    )
    
    # Select all detriments for Cyborg
    for detriment in Detriment.objects.filter(heritage=cyborg_heritage):
        spin_user.selected_detriments.add(detriment)
    
    # Calculate available HP for Cyborg
    base_hp_cyborg = cyborg_heritage.base_hp
    hp_from_detriments_cyborg = sum(d.hp_value for d in spin_user.selected_detriments.all())
    available_hp_cyborg = base_hp_cyborg + hp_from_detriments_cyborg

    # Add benefits up to the HP limit for Cyborg
    spent_hp_cyborg = 0
    for benefit in Benefit.objects.filter(heritage=cyborg_heritage).order_by('-hp_cost'):
        if spent_hp_cyborg + benefit.hp_cost <= available_hp_cyborg:
            spin_user.selected_benefits.add(benefit)
            spent_hp_cyborg += benefit.hp_cost

    # Playbook abilities
    spin_abilities = SpinAbility.objects.all()
    CharacterSpinAbility.objects.create(character=spin_user, spin_ability=spin_abilities.get(name='Golden Arc'))
    CharacterSpinAbility.objects.create(character=spin_user, spin_ability=spin_abilities.get(name='Vibrational Scan'))
    # Standard ability
    spin_user.standard_abilities.add(Ability.objects.get(name='Steady Barrage'))
    # Extra abilities from 'A' stat (2 abilities)
    spin_user.standard_abilities.add(Ability.objects.get(name='Echo Strikes'))
    spin_user.standard_abilities.add(Ability.objects.get(name='Bizarre Intuition'))
    print("Created Spin User character.")

    # Character 3: Hamon User
    pillar_man_heritage = Heritage.objects.get(name='Pillar Man')
    hamon_user = Character.objects.create(
        user=user,
        true_name='Hammy - Level 1 Character Test',
        alias='Hammy',
        heritage=pillar_man_heritage,
        playbook='HAMON',
        coin_stats={'power': 'A', 'speed': 'A', 'range': 'C', 'durability': 'F', 'precision': 'F', 'development': 'F'},
        harm_level1_used=True,
        harm_level1_name='Battered & Bruised',
        harm_level2_used=True,
        harm_level2_name='Exhausted, Deep Cut',
        harm_level3_used=True,
        harm_level3_name='Impaired, Broken Leg',
        harm_level4_used=True,
        harm_level4_name='Fatal Wound'
    )
    # Heritage abilities - take all detriments to maximize HP gain
    for detriment in Detriment.objects.filter(heritage=pillar_man_heritage):
        hamon_user.selected_detriments.add(detriment)
    
    # Calculate available HP for Hamon User
    base_hp_hamon = pillar_man_heritage.base_hp
    hp_from_detriments_hamon = sum(d.hp_value for d in hamon_user.selected_detriments.all())
    available_hp_hamon = base_hp_hamon + hp_from_detriments_hamon

    # Add benefits up to the HP limit for Hamon User
    spent_hp_hamon = 0
    for benefit in Benefit.objects.filter(heritage=pillar_man_heritage).order_by('-hp_cost'):
        if spent_hp_hamon + benefit.hp_cost <= available_hp_hamon:
            hamon_user.selected_benefits.add(benefit)
            spent_hp_hamon += benefit.hp_cost

    # Playbook abilities
    hamon_abilities = HamonAbility.objects.all()
    CharacterHamonAbility.objects.create(character=hamon_user, hamon_ability=hamon_abilities.get(name='Ripple Breathing'))
    CharacterHamonAbility.objects.create(character=hamon_user, hamon_ability=hamon_abilities.get(name='Overdrive'))
    CharacterHamonAbility.objects.create(character=hamon_user, hamon_ability=hamon_abilities.get(name='Zoom Punch'))
    print("Created Hamon User character.")

create_test_characters()