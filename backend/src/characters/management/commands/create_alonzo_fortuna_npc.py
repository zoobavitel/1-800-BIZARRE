from django.core.management.base import BaseCommand
from characters.models import NPC, Ability
import json

class Command(BaseCommand):
    help = "Creates the Alonzo Fortuna NPC with specific attributes."

    def handle(self, *args, **options):
        self.stdout.write("Creating Alonzo Fortuna NPC...")

        # Define Alonzo Fortuna's attributes
        alonzo_fortuna_data = {
            "name": "Alonzo Fortuna",
            "level": 1,
            "appearance": "Placeholder appearance.",
            "role": "Italian American Lawyer and Technical consultant",
            "weakness": "Obsession - constantly plagued by wanting to learn new things",
            "need": "To constantly acquire new knowledge and skills.",
            "desire": "To master every field he encounters.",
            "rumour": "He knows a guy for everything, and has dirt on everyone.",
            "secret": "He once used his Stand to win a high-stakes poker game, but felt immense guilt afterwards.",
            "passion": "Collecting rare and obscure technical manuals and legal precedents.",
            "description": "A sharp-witted and endlessly curious lawyer, Alonzo Fortuna is a walking encyclopedia of knowledge, always seeking to expand his understanding of the world, often to his own detriment.",
            "stand_durability": "B",
            "stand_power": "C",
            "stand_speed": "C",
            "stand_precision": "C",
            "stand_range": "D",
            "stand_potential": "F",
            "harm_clock_max": 8,
            "vulnerability_clock_max": 4,
            "armor_charges": 3,
            "special_armor": 3,
            "purveyor": "The Bunker",
            "contacts": "Trump, Police, City electrician",
            "rivals": "The Mayor, Stand Investigation Group, Speedwagon",
            "faction_status": json.dumps({
                "Trump": 3,
                "Police": 2,
                "City Electrician": 1,
                "The Mayor": -2,
                "Stand Investigation Group": -3,
                "Speedwagon": -3
            }),
            "inventory": json.dumps([
                "Briefcase (contains legal documents and a laptop)",
                "Smartphone",
                "Expensive suit",
                "Pocket protector with various pens",
                "Small, antique compass"
            ]),
            "notes": "Stand Evolution: This NPC has potential for Stand evolution based on story progression.",
        }

        # Create or update the NPC
        alonzo, created = NPC.objects.update_or_create(
            name=alonzo_fortuna_data["name"],
            defaults=alonzo_fortuna_data
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Successfully created NPC: {alonzo.name}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Successfully updated NPC: {alonzo.name}"))

        # Create or update Abilities
        abilities_data = [
            {
                "name": "Calculus",
                "description": "Use 1 (Utility): Small antenna bound to victims for usage of their brain for calculations. Overuse can cause fatigue (level 1 if controlled, level 2 if risky, level 3 if desperate). Use 2 (Offense/Debuff): Players roll -1d on all actions while this ability is active. Use 3 (Defense/Support): Antenna secretes a psychoactive rush (level 2 harm) to calm infected, which gets the person \"hooked.\"",
                "ability_type": "Stand",
                "npc": alonzo
            },
            {
                "name": "Brain Blast",
                "description": "Use 1 (Offense/Environmental): Able to form a Devil's palm if user collects 100 victims. The Devil's palm can cause random environmental changes. Use 2 (Defense): While controlling numerous victims, able to +2 damage reduction until defense or vulnerability clock is full. Use 3 (Utility/Offense): Able to pull entities up to his range into the Soul State.",
                "ability_type": "Stand",
                "npc": alonzo
            },
        ]

        for ability_data in abilities_data:
            ability, created = Ability.objects.update_or_create(
                name=ability_data["name"],
                npc=alonzo,
                defaults=ability_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"  Successfully created Ability: {ability.name}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"  Successfully updated Ability: {ability.name}"))

        self.stdout.write(self.style.SUCCESS("Alonzo Fortuna NPC creation/update complete."))
