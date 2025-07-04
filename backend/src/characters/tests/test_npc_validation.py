from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from characters.models import Campaign, NPC


class NPCModelTest(TestCase):
    """Test NPC model for campaign management."""
    
    def setUp(self):
        """Set up test campaign."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
    
    def test_npc_creation(self):
        """Test NPC creation with stats."""
        npc = NPC.objects.create(
            campaign=self.campaign,
            creator=self.gm_user,
            name='Dio Brando',
            description='A vampire with incredible charisma and ambition.',
            stand_coin_stats={
                'POWER': 'S',
                'SPEED': 'A',
                'DURABILITY': 'S',
                'PRECISION': 'C',
                'RANGE': 'C',
                'POTENTIAL': 'C'
            }
        )
        
        self.assertEqual(npc.name, 'Dio Brando')
        self.assertEqual(npc.campaign, self.campaign)
        self.assertEqual(npc.stand_coin_stats['POWER'], 'S')
        
        self.assertEqual(str(npc), 'Dio Brando (NPC for Test Campaign)')
