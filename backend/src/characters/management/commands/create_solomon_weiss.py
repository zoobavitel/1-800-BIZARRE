from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Stand, Ability, SpinAbility, Vice, CharacterSpinAbility

class Command(BaseCommand):
    help = "Create the character Solomon Weiss and his stand Kid A."

    def handle(self, *args, **options):
        try:
            # Get user and campaign
            user = User.objects.get(username='Insectophobia')
            campaign, _ = Campaign.objects.get_or_create(name='A History of Bad Men', defaults={'gm': user})

            # Create Vice
            vice, _ = Vice.objects.get_or_create(
                name='Sketching',
                defaults={'description': 'The character finds solace and focus in sketching.'}
            )

            # Create Character
            solomon, created = Character.objects.get_or_create(
                true_name='Solomon Weiss',
                defaults={
                    'user': user,
                    'campaign': campaign,
                    'alias': 'Dominic',
                    'stand_name': 'Kid A',
                    'level': 5,
                    'background_note': 'An artist turned savant mathematician obsessed with fixing the flaws in the system. “I have seen the truth, and you are all broken.”',
                    'background_note2': 'Purveyor: The Archivist, an advanced AI\nNotes:\nItems:\n1. \n2. \n3. \nContacts:\n1. \n2. \n3. ',
                    'vice': vice,
                    'close_friend': 'Other members of BADMEN',
                    'rival': 'The Joestar Family',
                    'action_dots': {
                        'insight': 3, 'hunt': 2, 'study': 2, 'survey': 1, 'tinker': 0,
                        'prowess': 1, 'finesse': 1, 'prowl': 0, 'skirmish': 0, 'wreck': 0,
                        'resolve': 3, 'bizarre': 4, 'command': 2, 'consort': 0, 'sway': 1
                    },
                    'coin_stats': {
                        'durability': 'D', 'power': 'A', 'speed': 'C',
                        'precision': 'C', 'range': 'S', 'development_potential': 'F'
                    },
                    'stress': 2,
                    'total_xp_spent': 5,
                    'inventory': {},
                }
            )

            if created:
                self.stdout.write(self.style.SUCCESS('Successfully created Solomon Weiss'))

                # Create Stand
                stand, _ = Stand.objects.get_or_create(
                    character=solomon,
                    name='Kid A',
                    defaults={
                        'power': 'A',
                        'speed': 'C',
                        'range': 'S',
                        'durability': 'D',
                        'precision': 'C',
                        'development': 'F',
                    }
                )

                # Abilities
                ability1 = Ability.objects.create(
                    name='Everything in its Right Place',
                    type='other',
                    description='Use 1: “Two Colors in my Head” - Causes the target to lose the ability to process complexity causing black and white thinking.\nUse 2: “What Was That You Tried to Say?” - Forces targets to say things the user wants them to say as long as it is within reason. The target does not know this is occurring.\nUse 3: “I Woke Up Sucking On A Lemon” - Erases the target’s emotions entirely, reducing them to a new-born state. They become neutral, unable to feel any emotion, obeying commands without resistance. Once the effect is over, the target gains all their emotions back at once, causing an overwhelming rush of emotion leading to breakdowns.'
                )
                ability2 = Ability.objects.create(
                    name='How to Disappear Completely',
                    type='other',
                    description='Use 1: A target within this ability ceases to exist conceptually, experiencing the existential horror of nonexistence. Any target is impossible to target but can also not harm anyone as they theoretically don’t exist.\nUse 2: Solomon can use How to Disappear Completely alongside In Limbo to effectively teleport to where he needs to be. Using the ley lines of the soul state, he can “blink” into the soul state and appear elsewhere. This is not a reaction, but may be used for flair.'
                )
                ability3 = Ability.objects.create(
                    name='In Limbo',
                    type='other',
                    description='Use 1: Distorts the area around a target to change how their movement/range works (e.g. infinite hallway, unstable ground, doors open to random rooms instead, etc.)'
                )
                solomon.standard_abilities.add(ability1, ability2, ability3)

                spin_ability1 = SpinAbility.objects.create(
                    name='Sense',
                    spin_type='INVESTIGATIVE',
                    description='Can detect beings in the vicinity of rooms.'
                )
                CharacterSpinAbility.objects.create(character=solomon, spin_ability=spin_ability1)

                spin_ability2 = SpinAbility.objects.create(
                    name='Tether',
                    spin_type='INVESTIGATIVE',
                    description='While spin can be used to detect beings in the vicinity of rooms, combining this with a deeper understanding of the soul state unlocks a connection between the two. Using the ley lines of the souls state, Solomon can track specific targets over infinite distance and detect beings not just within rooms. But within specific ranges he sets (not exceeding 200ft radius).'
                )
                CharacterSpinAbility.objects.create(character=solomon, spin_ability=spin_ability2)

                ability4 = Ability.objects.create(
                    name='Functioning Vice',
                    type='standard',
                    description='When you indulge your vice, you may adjust the dice outcome by 1 or 2 (up or down). An ally who joins in your vice may do the same.'
                )
                ability5 = Ability.objects.create(
                    name='Stand Evolution',
                    type='standard',
                    description='Your Stand can temporarily evolve mid-battle. Spend 5 stress to gain a new minor ability for the duration of the scene.'
                )
                solomon.standard_abilities.add(ability4, ability5)

                self.stdout.write(self.style.SUCCESS('Successfully created abilities for Solomon Weiss'))
            else:
                self.stdout.write(self.style.WARNING('Solomon Weiss already exists.'))

        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('User Insectophobia not found.'))
        except Campaign.DoesNotExist:
            self.stdout.write(self.style.ERROR('Campaign "A History of Bad Men" not found.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'An error occurred: {e}'))