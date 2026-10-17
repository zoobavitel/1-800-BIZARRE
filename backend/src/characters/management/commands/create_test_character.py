from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import (
    Character,
    Heritage,
    Benefit,
    Detriment,
    Vice,
    Ability,
    HamonAbility,
    SpinAbility,
    CharacterHamonAbility,
    CharacterSpinAbility,
)


class Command(BaseCommand):
    help = "Create test characters for development and testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            default="testuser",
            help="Username for the test user",
        )
        parser.add_argument(
            "--count", type=int, default=3, help="Number of test characters to create"
        )
        parser.add_argument(
            "--playbook",
            type=str,
            choices=["STAND", "HAMON", "SPIN"],
            default="STAND",
            help="Playbook type for test characters",
        )

    def handle(self, *args, **options):
        username = options["username"]
        count = options["count"]
        playbook = options["playbook"]

        # Create or get test user
        user, created = User.objects.get_or_create(
            username=username, defaults={"email": f"{username}@test.com"}
        )
        if created:
            user.set_password("testpass123")
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created test user: {username}"))
        else:
            self.stdout.write(self.style.WARNING(f"Using existing user: {username}"))

        # Get or create required data
        heritage = self._get_or_create_heritage()
        vice = self._get_or_create_vice()
        abilities = self._get_or_create_abilities()
        hamon_abilities = self._get_or_create_hamon_abilities()
        spin_abilities = self._get_or_create_spin_abilities()

        # Create test characters
        for i in range(count):
            character = self._create_test_character(
                user,
                heritage,
                vice,
                abilities,
                hamon_abilities,
                spin_abilities,
                playbook,
                i,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created test character: {character.true_name} (ID: {character.id})"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created {count} test characters for {username}"
            )
        )

    def _get_or_create_heritage(self):
        """Get or create a test heritage with benefits and detriments"""
        heritage, created = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "A standard human heritage"},
        )

        if created:
            # Create benefits
            benefits = [
                ("Iron Will", 2, "Gain +1 stress box"),
                ("Quick Reflexes", 1, "Gain +1 action rating in one physical action"),
            ]
            for name, cost, desc in benefits:
                Benefit.objects.get_or_create(
                    name=name,
                    heritage=heritage,
                    defaults={"hp_cost": cost, "description": desc},
                )

            # Create detriments
            detriments = [
                ("Haunted Past", 2, "You have a dark history that follows you"),
                ("Weak Constitution", 1, "You are more susceptible to harm"),
            ]
            for name, value, desc in detriments:
                Detriment.objects.get_or_create(
                    name=name,
                    heritage=heritage,
                    defaults={"hp_value": value, "description": desc},
                )

            self.stdout.write(f"Created heritage: {heritage.name}")

        return heritage

    def _get_or_create_vice(self):
        """Get or create a test vice"""
        vice, created = Vice.objects.get_or_create(
            name="Loyalty", defaults={"description": "Devotion to friends and family"}
        )
        if created:
            self.stdout.write(f"Created vice: {vice.name}")
        return vice

    def _get_or_create_abilities(self):
        """Get or create test standard abilities"""
        abilities = [
            ("Shadow", "You can move through shadows and darkness"),
            ("Iron Will", "Gain +1 stress box"),
            ("Foresight", "You can see potential outcomes"),
            ("Calculating", "Gain +1 action rating in one mental action"),
        ]

        created_abilities = []
        for name, desc in abilities:
            ability, created = Ability.objects.get_or_create(
                name=name, defaults={"type": "standard", "description": desc}
            )
            created_abilities.append(ability)
            if created:
                self.stdout.write(f"Created ability: {ability.name}")

        return created_abilities

    def _get_or_create_hamon_abilities(self):
        """Get or create test Hamon abilities"""
        abilities = [
            ("Foundation Hamon", "FOUNDATION", "Basic Hamon breathing techniques"),
            ("Caesar Style", "CAESAR_STYLE", "Bubble-based Hamon combat techniques"),
            ("Cyber Style", "CYBER_STYLE", "Ripple channeled through cybernetics"),
        ]

        created_abilities = []
        for name, hamon_type, desc in abilities:
            ability, created = HamonAbility.objects.get_or_create(
                name=name,
                defaults={
                    "hamon_type": hamon_type,
                    "description": desc,
                    "stress_cost": 1,
                },
            )
            created_abilities.append(ability)
            if created:
                self.stdout.write(f"Created Hamon ability: {ability.name}")

        return created_abilities

    def _get_or_create_spin_abilities(self):
        """Get or create test Spin abilities"""
        abilities = [
            ("Spin Foundation", "FOUNDATION", "Basic Spin techniques"),
            ("Cavalier Spin", "CAVALIER", "Advanced Spin combat techniques"),
            ("Ballbreaker Spin", "BALLBREAKER", "Spin disruption and nullification"),
        ]

        created_abilities = []
        for name, spin_type, desc in abilities:
            ability, created = SpinAbility.objects.get_or_create(
                name=name,
                defaults={
                    "spin_type": spin_type,
                    "description": desc,
                    "stress_cost": 1,
                },
            )
            created_abilities.append(ability)
            if created:
                self.stdout.write(f"Created Spin ability: {ability.name}")

        return created_abilities

    def _create_test_character(
        self,
        user,
        heritage,
        vice,
        abilities,
        hamon_abilities,
        spin_abilities,
        playbook,
        index,
    ):
        """Create a test character with the specified playbook"""

        # Basic character data
        character_data = {
            "user": user,
            "true_name": f"Test Character {index + 1}",
            "alias": f"Test{index + 1}",
            "appearance": f"A test character with {playbook.lower()} abilities",
            "heritage": heritage,
            "vice": vice,
            "playbook": playbook,
            "background_note": f"Test character created for development purposes",
            "close_friend": "Test Friend",
            "rival": "Test Rival",
            "action_dots": {
                "insight": {"hunt": 1, "study": 1, "survey": 0, "tinker": 0},
                "prowess": {"finesse": 1, "prowl": 0, "skirmish": 1, "wreck": 0},
                "resolve": {"bizarre": 0, "command": 1, "consort": 0, "sway": 1},
            },
            "stress": 0,
            "trauma": [],
            "loadout": 1,
        }

        # Playbook-specific data
        if playbook == "STAND":
            character_data.update(
                {
                    "stand_name": f"Test Stand {index + 1}",
                    "coin_stats": {
                        "power": "B",
                        "speed": "B",
                        "range": "C",
                        "durability": "B",
                        "precision": "B",
                        "development": "C",
                    },
                }
            )
        elif playbook == "HAMON":
            character_data.update(
                {
                    "coin_stats": {
                        "power": "A",
                        "speed": "B",
                        "range": "C",
                        "durability": "B",
                        "precision": "A",
                        "development": "C",
                    }
                }
            )
        elif playbook == "SPIN":
            character_data.update(
                {
                    "coin_stats": {
                        "power": "B",
                        "speed": "A",
                        "range": "B",
                        "durability": "C",
                        "precision": "A",
                        "development": "B",
                    }
                }
            )

        # Create character
        character = Character.objects.create(**character_data)

        # Add standard abilities
        character.standard_abilities.set(abilities[:2])  # Add first 2 abilities

        # Add playbook-specific abilities
        if playbook == "HAMON" and hamon_abilities:
            CharacterHamonAbility.objects.create(
                character=character, hamon_ability=hamon_abilities[0]
            )
        elif playbook == "SPIN" and spin_abilities:
            CharacterSpinAbility.objects.create(
                character=character, spin_ability=spin_abilities[0]
            )

        # Add some benefits and detriments
        benefits = heritage.benefits.all()[:1]
        detriments = heritage.detriments.all()[:1]
        character.selected_benefits.set(benefits)
        character.selected_detriments.set(detriments)

        return character
