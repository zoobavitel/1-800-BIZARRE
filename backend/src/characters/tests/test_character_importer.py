
from django.test import TestCase
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Heritage, Vice, Benefit, Detriment, Ability
from characters.serializers import CharacterSerializer

class CharacterImporterTest(TestCase):
    def setUp(self):
        # Create necessary related objects
        self.user = User.objects.create_user(username='monkeysouz18', password='password')
        self.campaign = Campaign.objects.create(name='A History of Bad Men', gm=self.user)
        self.heritage = Heritage.objects.create(name='Rock Human', base_hp=2)
        self.vice = Vice.objects.create(name='Drugs')

        # Create some benefits and detriments for the Rock Human heritage
        self.benefit1 = Benefit.objects.create(heritage=self.heritage, name='Sediment Body', hp_cost=1)
        self.benefit2 = Benefit.objects.create(heritage=self.heritage, name='Hardened Physique', hp_cost=2)
        self.benefit3 = Benefit.objects.create(heritage=self.heritage, name='Camouflage', hp_cost=1)
        self.detriment1 = Detriment.objects.create(heritage=self.heritage, name='Sinks Like a Rock', hp_value=1)
        self.detriment2 = Detriment.objects.create(heritage=self.heritage, name='Slow Regeneration', hp_value=1)
        self.detriment3 = Detriment.objects.create(heritage=self.heritage, name='Cold-Brittle', hp_value=1)

        # Create some standard abilities
        self.ability1 = Ability.objects.create(name='Resolve Overdrive', type='standard')
        self.ability2 = Ability.objects.create(name='Venomous', type='standard')


    def test_harmonic_havoc_character_creation(self):
        character_data = {
            "true_name": "Mingo",
            "alias": "Harmonic Havoc",
            "level": 5,
            "playbook": "STAND",
            "vice_details": "Drugs, Purveyor: Lil guy on head",
            "close_friend": "Mother Nature",
            "rival": "Big Pharma",
            "action_dots": {
                "insight": {"hunt": 0, "study": 0, "survey": 1, "tinker": 0},
                "prowess": {"finesse": 2, "prowl": 2, "skirmish": 0, "wreck": 0},
                "resolve": {"bizarre": 2, "command": 0, "consort": 0, "sway": 0}
            },
            "stand_name": "Harmonic Havoc",
            "coin_stats": {
                "power": "F", "speed": "B", "range": "A",
                "durability": "F", "precision": "B", "development": "D"
            },
            "stress": 3,
            "trauma": [],
            "custom_ability_description": "Harmonic Havoc: 1. Redirect velocity of objects or effect back to the point of origin. 2. Play a note and give a teammate(s) an extra 1d6 to attack or resistance rolls. 3. Elongate/scale inorganic entities up to stand Range.",
            "extra_custom_abilities": [
                {"name": "Uno Reverse", "description": "1. Able to make copies of a reflected projectile & reflect them to other opponents. 2. Able to roll to regain stress mid battle using finesse or bizarre."}
            ],
            "inventory": [],
            "reputation_status": {},
            "campaign": self.campaign.id,
            "user": self.user.id,
            "heritage": self.heritage.id,
            "vice": self.vice.id,
            "selected_benefits": [self.benefit1.id, self.benefit2.id, self.benefit3.id],
            "selected_detriments": [self.detriment1.id, self.detriment2.id, self.detriment3.id],
            "standard_abilities": [self.ability1.id, self.ability2.id],
        }

        serializer = CharacterSerializer(data=character_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        character = serializer.save()

        self.assertEqual(character.true_name, "Mingo")
        self.assertEqual(character.level, 5)
        self.assertEqual(character.selected_benefits.count(), 3)
        self.assertEqual(character.selected_detriments.count(), 3)
        self.assertEqual(character.standard_abilities.count(), 2)
