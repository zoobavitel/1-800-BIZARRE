from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Heritage, Vice, Ability, Stand, StandAbility


class Command(BaseCommand):
    help = "Create a test user and assign Jack Rice with The Phoenix stand to them"

    def handle(self, *args, **options):
        # Create or get test user for Jack Rice
        user, created = User.objects.get_or_create(
            username="jack_rice_player",
            defaults={
                "email": "jack_rice_player@example.com",
            },
        )

        if created:
            user.set_password(User.objects.make_random_password())
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f"Created user: {user.username} (ID: {user.id})")
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"User {user.username} already exists (ID: {user.id})"
                )
            )

        # Check if Jack Rice character already exists
        if Character.objects.filter(true_name="Jack Rice").exists():
            jack_rice = Character.objects.get(true_name="Jack Rice")
            self.stdout.write(
                self.style.WARNING(
                    f"Character Jack Rice already exists (ID: {jack_rice.id})"
                )
            )

            # Update the character to belong to the test user
            if jack_rice.user != user:
                jack_rice.user = user
                jack_rice.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Updated Jack Rice to belong to {user.username}"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f"Jack Rice already belongs to {user.username}")
                )
        else:
            # Create Jack Rice character
            jack_rice = self._create_jack_rice_character(user)
            self.stdout.write(
                self.style.SUCCESS(f"Created Jack Rice character (ID: {jack_rice.id})")
            )

        # Display character details
        self._display_character_details(jack_rice)

    def _create_jack_rice_character(self, user):
        """Create Jack Rice character with The Phoenix stand."""

        # Get or create required data
        heritage = self._get_or_create_heritage()
        vice = self._get_or_create_vice()
        ability = self._get_or_create_ability()

        # Create character
        character = Character.objects.create(
            user=user,
            true_name="Jack Rice",
            alias="Jack",
            appearance="A former Passione member with adrenaline-driven ambition",
            heritage=heritage,
            vice=vice,
            playbook="STAND",
            background_note="Originally a member of Passione with adrenaline-driven ambition",
            close_friend="David Helmouth (Stand: I Don't Care)",
            rival="",
            action_dots={
                "insight": {"hunt": 0, "study": 0, "survey": 0, "tinker": 0},
                "prowess": {"finesse": 1, "prowl": 0, "skirmish": 2, "wreck": 1},
                "resolve": {"attune": 1, "command": 0, "consort": 1, "sway": 1},
            },
            stress=10,  # Based on C-rank durability
            trauma=[],
            loadout=1,
            coin_stats={
                "power": "B",
                "speed": "C",
                "range": "D",
                "durability": "C",
                "precision": "D",
                "development": "D",
            },
        )

        # Add standard ability
        character.standard_abilities.add(ability)

        # Create The Phoenix stand
        stand = Stand.objects.create(
            character=character,
            name="The Phoenix",
            type="FIGHTING",  # Fighting Spirit type
            form="Humanoid",
            consciousness_level="C",
            power="B",
            speed="C",
            range="D",
            durability="C",
            precision="D",
            development="D",
            armor=0,
        )

        # Create stand ability
        StandAbility.objects.create(
            stand=stand,
            name="Burn to the Wayside and Rise From the Ashes",
            description="Can imbue anything with decay that acts as acid. Rebirth effect strengthens items. Filling a Decay Clock causes rebirth. Rebirth may grant +1d, +1 effect, resistance, or a mutation.",
        )

        return character

    def _get_or_create_heritage(self):
        """Get or create Passione Ex-Member heritage."""
        heritage, created = Heritage.objects.get_or_create(
            name="Passione Ex-Member",
            defaults={
                "base_hp": 0,
                "description": "Originally a member of Passione with adrenaline-driven ambition",
            },
        )
        if created:
            self.stdout.write(f"Created heritage: {heritage.name}")
        return heritage

    def _get_or_create_vice(self):
        """Get or create Fun vice."""
        vice, created = Vice.objects.get_or_create(
            name="Fun",
            defaults={
                "description": "Derives thrill from physical activity, danger, and games"
            },
        )
        if created:
            self.stdout.write(f"Created vice: {vice.name}")
        return vice

    def _get_or_create_ability(self):
        """Get or create Swan Song ability."""
        ability, created = Ability.objects.get_or_create(
            name="Swan Song",
            defaults={
                "type": "standard",
                "description": "When you would be taken out by harm (Level 4), you may spend all remaining Stand armor charges (minimum 1) to remain standing for a short but heroic moment. You can take one last action before you collapse. If that action prevents or cancels the harm, you remain conscious.",
            },
        )
        if created:
            self.stdout.write(f"Created ability: {ability.name}")
        return ability

    def _display_character_details(self, character):
        """Display character details."""
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("CHARACTER DETAILS")
        self.stdout.write("=" * 50)
        self.stdout.write(f"Name: {character.true_name}")
        self.stdout.write(f"User: {character.user.username}")
        self.stdout.write(f"Playbook: {character.playbook}")
        self.stdout.write(f"Heritage: {character.heritage.name}")
        self.stdout.write(f"Vice: {character.vice.name}")
        self.stdout.write(f"Stress: {character.stress}")
        self.stdout.write(f"Close Friend: {character.close_friend}")

        if hasattr(character, "stand"):
            stand = character.stand
            self.stdout.write("\nSTAND DETAILS")
            self.stdout.write("-" * 30)
            self.stdout.write(f"Name: {stand.name}")
            self.stdout.write(f"Type: {stand.type}")
            self.stdout.write(f"Form: {stand.form}")
            self.stdout.write(f"Power: {stand.power}")
            self.stdout.write(f"Speed: {stand.speed}")
            self.stdout.write(f"Range: {stand.range}")
            self.stdout.write(f"Durability: {stand.durability}")
            self.stdout.write(f"Precision: {stand.precision}")
            self.stdout.write(f"Development: {stand.development}")

            # Display stand abilities
            for ability in stand.abilities.all():
                self.stdout.write(f"\nAbility: {ability.name}")
                self.stdout.write(f"Description: {ability.description}")

        self.stdout.write("\n" + "=" * 50)
