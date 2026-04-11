from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Heritage, Benefit, Detriment, Vice, Ability


class Command(BaseCommand):
    help = "Create the character Aya Funsami"

    def handle(self, *args, **options):
        # Create or get user
        user, created = User.objects.get_or_create(
            username="aya_funsami_player",
            defaults={"email": "aya_funsami_player@example.com"},
        )
        if created:
            user.set_password(User.objects.make_random_password())
            user.save()
            self.stdout.write(self.style.SUCCESS("Created user for Aya Funsami"))

        # Create or get heritage
        heritage, _ = Heritage.objects.get_or_create(
            name="Vampire",
            defaults={
                "base_hp": 10,
                "description": "Creatures of the night with a thirst for blood.",
            },
        )

        # Create detriments
        sunlight_weakness, _ = Detriment.objects.get_or_create(
            heritage=heritage,
            name="Sunlight Weakness",
            defaults={
                "hp_value": 2,
                "description": "Takes Level 4 Harm per minute in direct sunlight.",
            },
        )
        hamon_vulnerability, _ = Detriment.objects.get_or_create(
            heritage=heritage,
            name="Hamon Vulnerability",
            defaults={
                "hp_value": 1,
                "description": "Hamon techniques deal +1 Harm and bypass armor.",
            },
        )

        # Create benefits
        bloodthirst, _ = Benefit.objects.get_or_create(
            heritage=heritage,
            name="Bloodthirst",
            defaults={
                "hp_cost": 0,
                "description": "You are capable of drinking anything through any appendage",
            },
        )
        blood_puppeteer, _ = Benefit.objects.get_or_create(
            heritage=heritage,
            name="Blood Puppeteer",
            defaults={
                "hp_cost": 3,
                "description": "If you drink a person’s blood, you can command them for 1 round.",
            },
        )

        # Create or get vice
        vice, _ = Vice.objects.get_or_create(
            name="Nicotine", defaults={"description": "Nicotine of any form."}
        )

        # Create abilities
        invisible_ink, _ = Ability.objects.get_or_create(
            name="Invisible Ink",
            defaults={
                "type": "other",
                "description": "Invisible Ink can store real-world objects on her body as tattoos or draw new ones using her Stand’s tattoo gun. These tattoos can be unstored at will, returning the object to its full size (up to half its original scale). When unstored, the object can be embedded with a fragment of the Stand, gaining mobility and limited autonomy. Up to [Durability Grade] embedded objects may exist in the world at once. To create a new item from scratch, roll Finesse. Results determine quality and complexity (see below). Created items cannot be embedded unless she spends 1 stress or 1 Stand Armor. Embedded objects act with the user’s action ratings (typically Finesse, Skirmish, or Wreck). Entities can be directed to act, and the colony of ink can be divided into groups and act at the same time. All embedded objects fade after [Development Potential Grade, D = 1, C = 2, etc] days unless re-inked. Embedded Object Health: Each embedded object has a base health of Level 1 Durability (equal to one hit of harm). To increase its durability, spend 1 stress when embedding to raise its health to match the Stand’s Durability grade (e.g., B = 3 levels of harm before destruction). Finesse Creation Roll Table (for drawn items): 1-3: Broken or incomplete version of the item. 4-5: Simple functional version, mundane or clunky. 6: Well-made and stylish version, reliable in most situations. Critical: Expert craftsmanship, counts as a fine item (+1 effect where applicable).",
            },
        )
        aura_of_confidence, _ = Ability.objects.get_or_create(
            name="Aura of Confidence",
            defaults={
                "type": "standard",
                "description": "Your presence inspires trust and courage. Allies within close range of you gain +1d to resistance rolls against fear or intimidation.",
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
                "description": "You have a bizarre sense for danger. You cannot be surprised and always act first in ambush situations.",
            },
        )

        # Create character
        character, created = Character.objects.get_or_create(
            true_name="Aya Funsami",
            defaults={
                "user": user,
                "alias": "Aya Funsami",
                "level": 5,
                "heritage": heritage,
                "vice": vice,
                "playbook": "STAND",
                "stand_name": "Invisible Ink",
                "close_friend": "",
                "rival": "JoJo’s",
                "action_dots": {
                    "insight": {"hunt": 0, "study": 0, "survey": 0, "tinker": 2},
                    "prowess": {"finesse": 2, "prowl": 0, "skirmish": 0, "wreck": 0},
                    "resolve": {"bizarre": 3, "command": 0, "consort": 0, "sway": 2},
                },
                "coin_stats": {
                    "power": "C",
                    "speed": "D",
                    "precision": "D",
                    "durability": "A",
                    "range": "D",
                    "development": "A",
                },
                "stress": 0,
                "total_xp_spent": 45,
                "action_dice_gained": 3,
                "stand_coin_points_gained": 3,
                "inventory": [
                    {"name": "Revolver (Tattoo)", "quantity": 1},
                    {"name": "Cigarettes and lighter (Tattoo)", "quantity": 1},
                    {"name": "Blood bags (Tattoo)", "quantity": 5},
                    {"name": "Katana", "quantity": 1},
                ],
            },
        )

        if created:
            character.selected_detriments.add(sunlight_weakness, hamon_vulnerability)
            character.selected_benefits.add(bloodthirst, blood_puppeteer)
            character.standard_abilities.add(
                aura_of_confidence, vigorous, bizarre_intuition
            )
            character.custom_ability_description = invisible_ink.description
            character.save()
            self.stdout.write(
                self.style.SUCCESS('Successfully created character "Aya Funsami"')
            )
        else:
            self.stdout.write(
                self.style.WARNING('Character "Aya Funsami" already exists.')
            )
