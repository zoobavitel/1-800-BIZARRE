from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Heritage, Vice, Ability


class Command(BaseCommand):
    help = "Create the character BoBo Jizarre and assign to campaign and user."

    def handle(self, *args, **options):
        # Create or get user laBoogy
        user_laboogy, created = User.objects.get_or_create(
            username="laBoogy", defaults={"email": "laboogy@example.com"}
        )
        if created:
            user_laboogy.set_password("12345678")
            user_laboogy.save()
            self.stdout.write(self.style.SUCCESS("Created user laBoogy"))
        else:
            self.stdout.write(self.style.WARNING("Using existing user laBoogy"))

        # Get or create campaign "A History of Bad Men"
        try:
            gm_user = User.objects.get(username="Pooj")  # Assuming Pooj is the GM
        except User.DoesNotExist:
            gm_user, _ = User.objects.get_or_create(
                username="default_gm",
                defaults={"email": "default_gm@example.com", "password": "password123"},
            )
            gm_user.set_password("password123")
            gm_user.save()
            self.stdout.write(
                self.style.WARNING("Created default_gm as Pooj not found.")
            )

        campaign, created = Campaign.objects.get_or_create(
            name="A History of Bad Men",
            defaults={"gm": gm_user, "description": "A campaign about bad men."},
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS('Created campaign "A History of Bad Men"')
            )
        else:
            self.stdout.write(
                self.style.WARNING('Using existing campaign "A History of Bad Men"')
            )

        # Get or create default heritage and vice
        heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "A standard human heritage"},
        )
        vice, _ = Vice.objects.get_or_create(
            name="Curiosity",
            defaults={"description": "A strong desire to know or learn things."},
        )

        # Create abilities
        scrubbing_bubbles, _ = Ability.objects.get_or_create(
            name="Scrubbing Bubbles",
            defaults={
                "type": "other",
                "description": "Use 1: Creates bubbles I can teleport between. Use 2: Can transport items via bubbles (Range). Use 3: Created bubbles can be used like slow moving grenades/ mines (1d6 per Precision Grade).",
            },
        )
        # Create 4 generic standard abilities to meet the A-rank requirement
        ability1, _ = Ability.objects.get_or_create(
            name="Generic Ability 1",
            defaults={"type": "standard", "description": "A generic standard ability."},
        )
        ability2, _ = Ability.objects.get_or_create(
            name="Generic Ability 2",
            defaults={"type": "standard", "description": "A generic standard ability."},
        )
        ability3, _ = Ability.objects.get_or_create(
            name="Generic Ability 3",
            defaults={"type": "standard", "description": "A generic standard ability."},
        )
        ability4, _ = Ability.objects.get_or_create(
            name="Generic Ability 4",
            defaults={"type": "standard", "description": "A generic standard ability."},
        )

        # Create character "BoBo Jizarre"
        character, created = Character.objects.get_or_create(
            true_name="BoBo Jizarre",
            defaults={
                "user": user_laboogy,
                "campaign": campaign,
                "alias": "BoBo Jizarre",
                "level": 1,
                "heritage": heritage,
                "vice": vice,
                "playbook": "STAND",
                "stand_name": "Clean Bandit",
                "action_dots": {
                    "insight": {"hunt": 1, "study": 1, "survey": 0, "tinker": 0},
                    "prowess": {"finesse": 0, "prowl": 0, "skirmish": 0, "wreck": 2},
                    "resolve": {"bizarre": 1, "command": 0, "consort": 1, "sway": 1},
                },
                "coin_stats": {
                    "power": "A",
                    "speed": "C",
                    "precision": "D",
                    "durability": "D",
                    "range": "C",
                    "development": "F",
                },
                "stress": 2,
                "total_xp_spent": 0,
                "inventory": [{"name": "12 continental coins", "quantity": 1}],
                "harm_level1_used": True,
                "harm_level1_name": "X",
                "harm_level2_used": True,
                "harm_level2_name": "X",
            },
        )

        if created:
            character.standard_abilities.add(
                scrubbing_bubbles, ability1, ability2, ability3, ability4
            )
            character.save()
            self.stdout.write(
                self.style.SUCCESS('Successfully created character "BoBo Jizarre"')
            )
        else:
            self.stdout.write(
                self.style.WARNING('Character "BoBo Jizarre" already exists.')
            )
