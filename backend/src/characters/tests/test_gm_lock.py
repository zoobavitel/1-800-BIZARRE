from django.test import TestCase
from django.core.management import call_command
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from characters.models import Character, Campaign, Vice

class GMLockTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testgm', password='password')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.user)
        self.vice = Vice.objects.create(name='Test Vice', description='A test vice')
        self.character = Character.objects.create(
            user=self.user,
            campaign=self.campaign,
            true_name='Test Character',
            alias='Test Player',
            level=1,
            vice=self.vice,
            action_dots={},
            coin_stats={},
            stress=0,
            total_xp_spent=0,
            inventory={}
        )

    def test_lock_field_prevents_change(self):
        # Lock the 'level' field
        call_command('lock_character_fields', self.character.true_name, '--fields', 'level', '--lock')
        
        # Reload character to ensure gm_locked_fields is fresh
        self.character.refresh_from_db()

        # Attempt to change the locked field
        with self.assertRaisesRegex(ValidationError, 'Field \'level\' is locked by the GM and cannot be changed.'):
            self.character.level = 2
            self.character.save()

    def test_unlocked_field_can_be_changed(self):
        # Ensure 'alias' is not locked initially
        self.assertNotIn('alias', self.character.gm_locked_fields)

        # Change an unlocked field
        self.character.alias = 'New Alias'
        self.character.save()
        self.character.refresh_from_db()
        self.assertEqual(self.character.alias, 'New Alias')

    def test_unlock_field_allows_change(self):
        # Lock the 'level' field first
        call_command('lock_character_fields', self.character.true_name, '--fields', 'level', '--lock')
        self.character.refresh_from_db()
        self.assertIn('level', self.character.gm_locked_fields)

        # Unlock the 'level' field
        call_command('lock_character_fields', self.character.true_name, '--fields', 'level', '--unlock')
        self.character.refresh_from_db()
        self.assertNotIn('level', self.character.gm_locked_fields)

        # Attempt to change the now unlocked field
        self.character.level = 3
        self.character.save()
        self.character.refresh_from_db()
        self.assertEqual(self.character.level, 3)
