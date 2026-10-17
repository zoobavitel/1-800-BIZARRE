from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import (
    Character,
    Heritage,
    Benefit,
    Detriment,
    Vice,
    Ability,
    Campaign,
)


class Command(BaseCommand):
    help = "Create the character Furio and assign him to a campaign"

    def handle(self, *args, **options):
        # Create or get user
        user, created = User.objects.get_or_create(
            username="Pooj", defaults={"email": "pooj@example.com"}
        )
        if created:
            user.set_password("12345678")
            user.save()
            self.stdout.write(self.style.SUCCESS("Created user Pooj"))
        else:
            self.stdout.write(self.style.WARNING("Using existing user Pooj"))

        # Get or create heritage (assuming Human for now, as not specified)
        heritage, _ = Heritage.objects.get_or_create(
            name="Human",
            defaults={"base_hp": 0, "description": "A standard human heritage"},
        )

        # Create or get vice
        vice, _ = Vice.objects.get_or_create(
            name="Smoking", defaults={"description": "Indulges in smoking."}
        )

        # Get or create the campaign
        campaign_name = "A History of Bad Men"
        campaign, created = Campaign.objects.get_or_create(
            name=campaign_name,
            defaults={"gm": user, "description": "A campaign about bad men."},
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created campaign: {campaign_name}"))
        else:
            self.stdout.write(
                self.style.WARNING(f"Using existing campaign: {campaign_name}")
            )

        # Create abilities
        concussive_shockwave, _ = Ability.objects.get_or_create(
            name="Concussive Shockwave",
            defaults={
                "type": "other",
                "description": "On hit, a target takes Level 3 Harm. Enemies within the radius (up to Range) are dealt level 2 harm. Spin objects now burn entities, dealing 1 level harm over a 4 segment clock period (unless the enemy resists). Targets are blinded over a 4 segment clock period (unless the enemy resists).",
            },
        )
        just_as_planned, _ = Ability.objects.get_or_create(
            name="Just As Planned",
            defaults={
                "type": "other",
                "description": "As long as a spin object is spinning, the user can control the spin object and use it as a weapon. While the object is spinning, the user can produce a radius of burning spin energy that deals Level 2 harm.",
            },
        )
        vigorous, _ = Ability.objects.get_or_create(
            name="Vigorous",
            defaults={
                "type": "standard",
                "description": "You recover from harm faster. Permanently fill in one of your healing clock segments. Take +1d to healing treatment rolls.",
            },
        )
        bizarre_intuition, _ = Ability.objects.get_or_create(
            name="Bizarre Intuition",
            defaults={
                "type": "standard",
                "description": "You have a bizarre sense for danger. You cannot be surprised.",
            },
        )
        satellite_ball, _ = Ability.objects.get_or_create(
            name="Satellite Ball",
            defaults={
                "type": "standard",
                "description": "Spin balls can be used to blind opponents; your next attack deals +1 effect",
            },
        )

        # Create character
        character, created = Character.objects.get_or_create(
            true_name="Furiguisto “Furio” Zeppeli",
            defaults={
                "user": user,
                "alias": "Furio",
                "level": 5,
                "heritage": heritage,
                "vice": vice,
                "playbook": "SPIN",
                "stand_name": "Ballbreaker",
                "campaign": campaign,
                "close_friend": "Llelwelyn McCarthy, Johnnie Moultisanti, Jack Rice, Ink",
                "rival": "Scippio Reammon",
                "action_dots": {
                    "insight": {"hunt": 1, "study": 2, "survey": 3, "tinker": 1},
                    "prowess": {"finesse": 3, "prowl": 1, "skirmish": 2, "wreck": 2},
                    "resolve": {"bizarre": 2, "command": 1, "consort": 1, "sway": 2},
                },
                "coin_stats": {
                    "power": "C",
                    "speed": "D",
                    "precision": "A",
                    "durability": "D",
                    "range": "D",
                    "development": "D",
                },
                "stress": 1,
                "total_xp_spent": 0,  # Assuming 0 for a new character, adjust if XP is meant to be spent
                "heritage_points_gained": 0,
                "stand_coin_points_gained": 0,
                "action_dice_gained": 0,
                "custom_ability_description": concussive_shockwave.description,
            },
        )

        if created:
            character.standard_abilities.add(
                vigorous, bizarre_intuition, satellite_ball
            )
            character.save()
            self.stdout.write(
                self.style.SUCCESS(
                    'Successfully created character "Furiguisto “Furio” Zeppeli"'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    'Character "Furiguisto “Furio” Zeppeli" already exists.'
                )
            )
