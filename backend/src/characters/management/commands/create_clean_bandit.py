from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Heritage, Vice


class Command(BaseCommand):
    help = "Create the character Clean Bandit and assign to campaign and user."

    def handle(self, *args, **options):
        # Create or get user laBoogy
        user_laboogy, created = User.objects.get_or_create(
            username="laBoogy",
            defaults={"email": "laboogy@example.com", "password": "password123"},
        )
        if created:
            user_laboogy.set_password("password123")
            user_laboogy.save()
            self.stdout.write(self.style.SUCCESS("Created user laBoogy"))
        else:
            self.stdout.write(self.style.WARNING("Using existing user laBoogy"))

        # Get or create campaign "A History of Bad Men"
        # Assuming 'Pooj' is a GM for this campaign, or create a default GM if needed
        try:
            gm_user = User.objects.get(username="Pooj")
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

        # Create character "clean bandit"
        character, created = Character.objects.get_or_create(
            true_name="clean bandit",
            defaults={
                "user": user_laboogy,
                "campaign": campaign,
                "alias": "Clean Bandit",
                "level": 1,
                "heritage": heritage,
                "vice": vice,
                "playbook": "STAND",
                "stand_name": "Default Stand",
                "action_dots": {
                    "insight": {"hunt": 1, "study": 1, "survey": 1, "tinker": 1},
                    "prowess": {"finesse": 1, "prowl": 1, "skirmish": 1, "wreck": 0},
                    "resolve": {"bizarre": 0, "command": 0, "consort": 0, "sway": 1},
                },
                "coin_stats": {
                    "power": "C",
                    "speed": "C",
                    "precision": "C",
                    "durability": "C",
                    "range": "C",
                    "development": "C",
                },
                "stress": 0,
                "total_xp_spent": 0,
            },
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS('Successfully created character "clean bandit"')
            )
        else:
            self.stdout.write(
                self.style.WARNING('Character "clean bandit" already exists.')
            )
