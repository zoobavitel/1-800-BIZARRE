from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from characters.models import Campaign, NPC, Heritage


class NPCModelTest(TestCase):
    """Test NPC model for campaign management."""
    
    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
        self.heritage = Heritage.objects.create(name='Human', base_hp=0, description='A standard human heritage')
    
    def test_npc_creation_basic(self):
        """Test basic NPC creation with minimal required fields."""
        npc = NPC.objects.create(
            name='Dio Brando',
            creator=self.gm_user,
            campaign=self.campaign,
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
        self.assertEqual(npc.creator, self.gm_user)
        self.assertEqual(npc.stand_coin_stats['POWER'], 'S')
        self.assertEqual(npc.level, 1)  # Default value
        self.assertEqual(npc.playbook, 'STAND')  # Default value
        
    def test_npc_creation_with_heritage(self):
        """Test NPC creation with heritage association."""
        npc = NPC.objects.create(
            name='Vampire Lord',
            creator=self.gm_user,
            campaign=self.campaign,
            heritage=self.heritage,
            stand_coin_stats={
                'POWER': 'A',
                'SPEED': 'B',
                'DURABILITY': 'A',
                'PRECISION': 'B',
                'RANGE': 'C',
                'POTENTIAL': 'D'
            }
        )
        
        self.assertEqual(npc.heritage, self.heritage)
        self.assertEqual(npc.heritage.name, 'Human')
        
    def test_npc_string_representation(self):
        """Test NPC string representation."""
        npc = NPC.objects.create(
            name='Test NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={}
        )
        
        expected_str = f"Test NPC (NPC for {self.campaign.name})"
        self.assertEqual(str(npc), expected_str)
        
    def test_npc_stand_coin_stats_default(self):
        """Test that NPC has default Stand Coin stats."""
        npc = NPC.objects.create(
            name='Default NPC',
            creator=self.gm_user,
            campaign=self.campaign
        )
        
        self.assertEqual(npc.stand_coin_stats, {})
        
    def test_npc_playbook_choices(self):
        """Test NPC playbook field choices."""
        npc = NPC.objects.create(
            name='Stand User',
            creator=self.gm_user,
            campaign=self.campaign,
            playbook='STAND'
        )
        
        self.assertEqual(npc.playbook, 'STAND')
        
        # Test other playbook choices
        npc.playbook = 'HAMON'
        npc.save()
        self.assertEqual(npc.playbook, 'HAMON')
        
        npc.playbook = 'SPIN'
        npc.save()
        self.assertEqual(npc.playbook, 'SPIN')


class NPCArmorSystemTest(TestCase):
    """Test NPC armor and vulnerability systems."""
    
    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
    
    def test_special_armor_charges_s_rank(self):
        """Test special armor charges for S-rank durability."""
        npc = NPC.objects.create(
            name='S-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'S'}
        )
        
        self.assertEqual(npc.special_armor_charges, 3)
        
    def test_special_armor_charges_a_rank(self):
        """Test special armor charges for A-rank durability."""
        npc = NPC.objects.create(
            name='A-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'A'}
        )
        
        self.assertEqual(npc.special_armor_charges, 3)
        
    def test_special_armor_charges_b_rank(self):
        """Test special armor charges for B-rank durability."""
        npc = NPC.objects.create(
            name='B-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'B'}
        )
        
        self.assertEqual(npc.special_armor_charges, 2)
        
    def test_special_armor_charges_c_rank(self):
        """Test special armor charges for C-rank durability."""
        npc = NPC.objects.create(
            name='C-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'C'}
        )
        
        self.assertEqual(npc.special_armor_charges, 1)
        
    def test_special_armor_charges_d_rank(self):
        """Test special armor charges for D-rank durability."""
        npc = NPC.objects.create(
            name='D-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'D'}
        )
        
        self.assertEqual(npc.special_armor_charges, 1)
        
    def test_special_armor_charges_f_rank(self):
        """Test special armor charges for F-rank durability."""
        npc = NPC.objects.create(
            name='F-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'F'}
        )
        
        self.assertEqual(npc.special_armor_charges, 0)
        
    def test_special_armor_charges_default(self):
        """Test special armor charges when no durability specified."""
        npc = NPC.objects.create(
            name='Default NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={}
        )
        
        self.assertEqual(npc.special_armor_charges, 0)


class NPCVulnerabilityClockTest(TestCase):
    """Test NPC vulnerability clock system."""
    
    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
    
    def test_vulnerability_clock_max_s_rank(self):
        """Test vulnerability clock max for S-rank durability."""
        npc = NPC.objects.create(
            name='S-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'S'}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 0)
        
    def test_vulnerability_clock_max_a_rank(self):
        """Test vulnerability clock max for A-rank durability."""
        npc = NPC.objects.create(
            name='A-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'A'}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 12)
        
    def test_vulnerability_clock_max_b_rank(self):
        """Test vulnerability clock max for B-rank durability."""
        npc = NPC.objects.create(
            name='B-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'B'}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 10)
        
    def test_vulnerability_clock_max_c_rank(self):
        """Test vulnerability clock max for C-rank durability."""
        npc = NPC.objects.create(
            name='C-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'C'}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 8)
        
    def test_vulnerability_clock_max_d_rank(self):
        """Test vulnerability clock max for D-rank durability."""
        npc = NPC.objects.create(
            name='D-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'D'}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 6)
        
    def test_vulnerability_clock_max_f_rank(self):
        """Test vulnerability clock max for F-rank durability."""
        npc = NPC.objects.create(
            name='F-Rank NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'DURABILITY': 'F'}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 4)
        
    def test_vulnerability_clock_max_default(self):
        """Test vulnerability clock max when no durability specified."""
        npc = NPC.objects.create(
            name='Default NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={}
        )
        
        self.assertEqual(npc.vulnerability_clock_max, 4)


class NPCMovementSpeedTest(TestCase):
    """Test NPC movement speed calculations."""
    
    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
    
    def test_movement_speed_s_rank(self):
        """Test movement speed for S-rank speed."""
        npc = NPC.objects.create(
            name='S-Rank Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'SPEED': 'S'}
        )
        
        self.assertEqual(npc.movement_speed, 200)
        
    def test_movement_speed_a_rank(self):
        """Test movement speed for A-rank speed."""
        npc = NPC.objects.create(
            name='A-Rank Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'SPEED': 'A'}
        )
        
        self.assertEqual(npc.movement_speed, 60)
        
    def test_movement_speed_b_rank(self):
        """Test movement speed for B-rank speed."""
        npc = NPC.objects.create(
            name='B-Rank Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'SPEED': 'B'}
        )
        
        self.assertEqual(npc.movement_speed, 40)
        
    def test_movement_speed_c_rank(self):
        """Test movement speed for C-rank speed."""
        npc = NPC.objects.create(
            name='C-Rank Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'SPEED': 'C'}
        )
        
        self.assertEqual(npc.movement_speed, 35)
        
    def test_movement_speed_d_rank(self):
        """Test movement speed for D-rank speed."""
        npc = NPC.objects.create(
            name='D-Rank Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'SPEED': 'D'}
        )
        
        self.assertEqual(npc.movement_speed, 30)
        
    def test_movement_speed_f_rank(self):
        """Test movement speed for F-rank speed."""
        npc = NPC.objects.create(
            name='F-Rank Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={'SPEED': 'F'}
        )
        
        self.assertEqual(npc.movement_speed, 25)
        
    def test_movement_speed_default(self):
        """Test movement speed when no speed specified."""
        npc = NPC.objects.create(
            name='Default Speed NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={}
        )
        
        self.assertEqual(npc.movement_speed, 25)


class NPCJSONFieldsTest(TestCase):
    """Test NPC JSON field functionality."""
    
    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(username='gm', email='gm@test.com', password='testpass')
        self.campaign = Campaign.objects.create(name='Test Campaign', gm=self.gm_user)
    
    def test_relationships_json_field(self):
        """Test NPC relationships JSON field."""
        relationships = {
            'Character A': 'Ally',
            'Character B': 'Rival',
            'Faction X': 'Neutral'
        }
        
        npc = NPC.objects.create(
            name='Relationship NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            relationships=relationships
        )
        
        self.assertEqual(npc.relationships, relationships)
        self.assertEqual(npc.relationships['Character A'], 'Ally')
        
    def test_items_json_field(self):
        """Test NPC items JSON field."""
        items = ['Sword', 'Shield', 'Potion']
        
        npc = NPC.objects.create(
            name='Item NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            items=items
        )
        
        self.assertEqual(npc.items, items)
        self.assertIn('Sword', npc.items)
        
    def test_contacts_json_field(self):
        """Test NPC contacts JSON field."""
        contacts = ['Contact 1', 'Contact 2']
        
        npc = NPC.objects.create(
            name='Contact NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            contacts=contacts
        )
        
        self.assertEqual(npc.contacts, contacts)
        self.assertIn('Contact 1', npc.contacts)
        
    def test_faction_status_json_field(self):
        """Test NPC faction status JSON field."""
        faction_status = {
            'Faction A': 2,
            'Faction B': -1,
            'Faction C': 0
        }
        
        npc = NPC.objects.create(
            name='Faction NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            faction_status=faction_status
        )
        
        self.assertEqual(npc.faction_status, faction_status)
        self.assertEqual(npc.faction_status['Faction A'], 2)
        
    def test_inventory_json_field(self):
        """Test NPC inventory JSON field."""
        inventory = ['Item 1', 'Item 2', 'Item 3']
        
        npc = NPC.objects.create(
            name='Inventory NPC',
            creator=self.gm_user,
            campaign=self.campaign,
            inventory=inventory
        )
        
        self.assertEqual(npc.inventory, inventory)
        self.assertIn('Item 1', npc.inventory)
