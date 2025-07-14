from django.core.management.base import BaseCommand, CommandError
from characters.models import Character
import json

class Command(BaseCommand):
    help = 'Locks or unlocks specified fields for a character.'

    def add_arguments(self, parser):
        parser.add_argument('character_name', type=str, help='The true name of the character.')
        parser.add_argument('--fields', nargs='+', type=str, help='A space-separated list of field names to lock/unlock.')
        parser.add_argument('--lock', action='store_true', help='Lock the specified fields.')
        parser.add_argument('--unlock', action='store_true', help='Unlock the specified fields.')

    def handle(self, *args, **options):
        character_name = options['character_name']
        fields_to_modify = options['fields']
        lock_action = options['lock']
        unlock_action = options['unlock']

        if not fields_to_modify:
            raise CommandError('Please provide at least one field name using --fields.')

        if lock_action and unlock_action:
            raise CommandError('Cannot use --lock and --unlock simultaneously. Choose one.')
        if not lock_action and not unlock_action:
            raise CommandError('Please specify either --lock or --unlock.')

        try:
            character = Character.objects.get(true_name=character_name)
        except Character.DoesNotExist:
            raise CommandError(f'Character "{character_name}" not found.')

        current_locked_fields = set(character.gm_locked_fields)
        modified_count = 0

        if lock_action:
            for field in fields_to_modify:
                if field not in current_locked_fields:
                    current_locked_fields.add(field)
                    modified_count += 1
                    self.stdout.write(self.style.SUCCESS(f'Locked field: {field}'))
                else:
                    self.stdout.write(self.style.WARNING(f'Field "{field}" is already locked.'))
        elif unlock_action:
            for field in fields_to_modify:
                if field in current_locked_fields:
                    current_locked_fields.remove(field)
                    modified_count += 1
                    self.stdout.write(self.style.SUCCESS(f'Unlocked field: {field}'))
                else:
                    self.stdout.write(self.style.WARNING(f'Field "{field}" is not locked.'))

        character.gm_locked_fields = list(current_locked_fields)
        character.save()

        if modified_count > 0:
            self.stdout.write(self.style.SUCCESS(f'\nSuccessfully updated locked fields for {character_name}.'))
        else:
            self.stdout.write(self.style.WARNING(f'\nNo changes made to locked fields for {character_name}.'))