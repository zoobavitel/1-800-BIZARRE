from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status
from characters.models import Campaign, NPC, Heritage, Benefit, Detriment
from characters.serializers import NPCSerializer


class NPCModelTest(TestCase):
    """Test NPC model for campaign management."""

    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(
            username="gm", email="gm@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm_user)
        self.heritage = Heritage.objects.create(
            name="Human", base_hp=0, description="A standard human heritage"
        )

    def test_npc_creation_basic(self):
        """Test basic NPC creation with minimal required fields."""
        npc = NPC.objects.create(
            name="Dio Brando",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={
                "POWER": "S",
                "SPEED": "A",
                "DURABILITY": "S",
                "PRECISION": "C",
                "RANGE": "C",
                "POTENTIAL": "C",
            },
        )

        self.assertEqual(npc.name, "Dio Brando")
        self.assertEqual(npc.campaign, self.campaign)
        self.assertEqual(npc.creator, self.gm_user)
        self.assertEqual(npc.stand_coin_stats["POWER"], "S")
        self.assertEqual(npc.level, 1)  # Default value
        self.assertEqual(npc.playbook, "STAND")  # Default value

    def test_npc_creation_with_heritage(self):
        """Test NPC creation with heritage association."""
        npc = NPC.objects.create(
            name="Vampire Lord",
            creator=self.gm_user,
            campaign=self.campaign,
            heritage=self.heritage,
            stand_coin_stats={
                "POWER": "A",
                "SPEED": "B",
                "DURABILITY": "A",
                "PRECISION": "B",
                "RANGE": "C",
                "POTENTIAL": "D",
            },
        )

        self.assertEqual(npc.heritage, self.heritage)
        self.assertEqual(npc.heritage.name, "Human")

    def test_npc_string_representation(self):
        """Test NPC string representation."""
        npc = NPC.objects.create(
            name="Test NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={},
        )

        expected_str = f"Test NPC (NPC for {self.campaign.name})"
        self.assertEqual(str(npc), expected_str)

    def test_npc_stand_coin_stats_default(self):
        """Test that NPC has default Stand Coin stats."""
        npc = NPC.objects.create(
            name="Default NPC", creator=self.gm_user, campaign=self.campaign
        )

        self.assertEqual(npc.stand_coin_stats, {})

    def test_npc_playbook_choices(self):
        """Test NPC playbook field choices."""
        npc = NPC.objects.create(
            name="Stand User",
            creator=self.gm_user,
            campaign=self.campaign,
            playbook="STAND",
        )

        self.assertEqual(npc.playbook, "STAND")

        # Test other playbook choices
        npc.playbook = "HAMON"
        npc.save()
        self.assertEqual(npc.playbook, "HAMON")

        npc.playbook = "SPIN"
        npc.save()
        self.assertEqual(npc.playbook, "SPIN")


class NPCVulnerabilityClockTest(TestCase):
    """Test NPC vulnerability clock system."""

    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(
            username="gm", email="gm@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm_user)

    def test_vulnerability_clock_max_s_rank(self):
        """Test vulnerability clock max for S-rank durability."""
        npc = NPC.objects.create(
            name="S-Rank NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "S"},
        )

        self.assertEqual(npc.vulnerability_clock_max, 0)

    def test_vulnerability_clock_max_a_rank(self):
        """Test vulnerability clock max for A-rank durability."""
        npc = NPC.objects.create(
            name="A-Rank NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "A"},
        )

        self.assertEqual(npc.vulnerability_clock_max, 12)

    def test_vulnerability_clock_max_b_rank(self):
        """Test vulnerability clock max for B-rank durability."""
        npc = NPC.objects.create(
            name="B-Rank NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "B"},
        )

        self.assertEqual(npc.vulnerability_clock_max, 10)

    def test_vulnerability_clock_max_c_rank(self):
        """Test vulnerability clock max for C-rank durability."""
        npc = NPC.objects.create(
            name="C-Rank NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "C"},
        )

        self.assertEqual(npc.vulnerability_clock_max, 8)

    def test_vulnerability_clock_max_d_rank(self):
        """Test vulnerability clock max for D-rank durability."""
        npc = NPC.objects.create(
            name="D-Rank NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "D"},
        )

        self.assertEqual(npc.vulnerability_clock_max, 6)

    def test_vulnerability_clock_max_f_rank(self):
        """Test vulnerability clock max for F-rank durability."""
        npc = NPC.objects.create(
            name="F-Rank NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "F"},
        )

        self.assertEqual(npc.vulnerability_clock_max, 4)

    def test_vulnerability_clock_max_default(self):
        """Test vulnerability clock max when no durability specified."""
        npc = NPC.objects.create(
            name="Default NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={},
        )

        self.assertEqual(npc.vulnerability_clock_max, 4)

    def test_npc_has_no_computed_armor_charges(self):
        npc = NPC.objects.create(
            name="No armor NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "A"},
        )
        self.assertFalse(hasattr(NPC, "regular_armor_charges"))
        self.assertFalse(hasattr(NPC, "stand_armor_charges"))
        self.assertFalse(hasattr(NPC, "special_armor_charges"))
        data = NPCSerializer(npc).data
        for key in (
            "regular_armor_charges",
            "stand_armor_charges",
            "special_armor_charges",
            "regular_armor_used",
            "stand_armor_used",
            "special_armor_used",
        ):
            self.assertNotIn(key, data)


class NPCMovementSpeedTest(TestCase):
    """Test NPC movement speed calculations."""

    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(
            username="gm", email="gm@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm_user)

    def test_movement_speed_s_rank(self):
        """Test movement speed for S-rank speed."""
        npc = NPC.objects.create(
            name="S-Rank Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"SPEED": "S"},
        )

        self.assertEqual(npc.movement_speed, 200)

    def test_movement_speed_a_rank(self):
        """Test movement speed for A-rank speed."""
        npc = NPC.objects.create(
            name="A-Rank Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"SPEED": "A"},
        )

        self.assertEqual(npc.movement_speed, 60)

    def test_movement_speed_b_rank(self):
        """Test movement speed for B-rank speed."""
        npc = NPC.objects.create(
            name="B-Rank Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"SPEED": "B"},
        )

        self.assertEqual(npc.movement_speed, 40)

    def test_movement_speed_c_rank(self):
        """Test movement speed for C-rank speed."""
        npc = NPC.objects.create(
            name="C-Rank Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"SPEED": "C"},
        )

        self.assertEqual(npc.movement_speed, 35)

    def test_movement_speed_d_rank(self):
        """Test movement speed for D-rank speed."""
        npc = NPC.objects.create(
            name="D-Rank Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"SPEED": "D"},
        )

        self.assertEqual(npc.movement_speed, 30)

    def test_movement_speed_f_rank(self):
        """Test movement speed for F-rank speed."""
        npc = NPC.objects.create(
            name="F-Rank Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"SPEED": "F"},
        )

        self.assertEqual(npc.movement_speed, 25)

    def test_movement_speed_default(self):
        """Test movement speed when no speed specified."""
        npc = NPC.objects.create(
            name="Default Speed NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={},
        )

        self.assertEqual(npc.movement_speed, 25)


class NPCJSONFieldsTest(TestCase):
    """Test NPC JSON field functionality."""

    def setUp(self):
        """Set up test data."""
        self.gm_user = User.objects.create_user(
            username="gm", email="gm@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm_user)

    def test_relationships_json_field(self):
        """Test NPC relationships JSON field."""
        relationships = {
            "Character A": "Ally",
            "Character B": "Rival",
            "Faction X": "Neutral",
        }

        npc = NPC.objects.create(
            name="Relationship NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            relationships=relationships,
        )

        self.assertEqual(npc.relationships, relationships)
        self.assertEqual(npc.relationships["Character A"], "Ally")

    def test_items_json_field(self):
        """Test NPC items JSON field."""
        items = ["Sword", "Shield", "Potion"]

        npc = NPC.objects.create(
            name="Item NPC", creator=self.gm_user, campaign=self.campaign, items=items
        )

        self.assertEqual(npc.items, items)
        self.assertIn("Sword", npc.items)

    def test_contacts_json_field(self):
        """Test NPC contacts JSON field."""
        contacts = ["Contact 1", "Contact 2"]

        npc = NPC.objects.create(
            name="Contact NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            contacts=contacts,
        )

        self.assertEqual(npc.contacts, contacts)
        self.assertIn("Contact 1", npc.contacts)

    def test_faction_status_json_field(self):
        """Test NPC faction status JSON field."""
        faction_status = {"Faction A": 2, "Faction B": -1, "Faction C": 0}

        npc = NPC.objects.create(
            name="Faction NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            faction_status=faction_status,
        )

        self.assertEqual(npc.faction_status, faction_status)
        self.assertEqual(npc.faction_status["Faction A"], 2)

    def test_inventory_json_field(self):
        """Test NPC inventory JSON field."""
        inventory = ["Item 1", "Item 2", "Item 3"]

        npc = NPC.objects.create(
            name="Inventory NPC",
            creator=self.gm_user,
            campaign=self.campaign,
            inventory=inventory,
        )

        self.assertEqual(npc.inventory, inventory)
        self.assertIn("Item 1", npc.inventory)


class NPCApplyEffectTest(TestCase):
    """Test GM-only apply-effect: effect fills NPC clocks; players cannot deal harm to NPCs."""

    def setUp(self):
        self.client = APIClient()
        self.gm_user = User.objects.create_user(
            username="gm", email="gm@test.com", password="testpass"
        )
        self.player_user = User.objects.create_user(
            username="player", email="player@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm_user)
        self.npc = NPC.objects.create(
            name="Villain",
            creator=self.gm_user,
            campaign=self.campaign,
            stand_coin_stats={"DURABILITY": "D"},
            vulnerability_clock_current=0,
        )

    def _auth_client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def test_gm_can_apply_effect_vulnerability_limited(self):
        """Limited effect adds 1 tick to vulnerability clock."""
        resp = self._auth_client(self.gm_user).post(
            f"/api/npcs/{self.npc.id}/apply-effect/",
            {"effect": "limited", "clock_type": "vulnerability"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["ticks_applied"], 1)
        self.assertEqual(resp.data["previous"], 0)
        self.assertEqual(resp.data["current"], 1)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.vulnerability_clock_current, 1)

    def test_gm_can_apply_effect_standard_and_extreme_vulnerability(self):
        """Standard = 2 ticks, extreme = 3 ticks on vulnerability (D-grade max 6)."""
        client = self._auth_client(self.gm_user)
        r1 = client.post(
            f"/api/npcs/{self.npc.id}/apply-effect/",
            {"effect": "standard", "clock_type": "vulnerability"},
            format="json",
        )
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.data["ticks_applied"], 2)
        self.assertEqual(r1.data["current"], 2)
        r2 = client.post(
            f"/api/npcs/{self.npc.id}/apply-effect/",
            {"effect": "extreme", "clock_type": "vulnerability"},
            format="json",
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data["ticks_applied"], 3)
        self.assertEqual(r2.data["current"], 5)
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.vulnerability_clock_current, 5)

    def test_player_cannot_apply_effect(self):
        """Players cannot deal harm to NPCs; only GM can apply effect (player gets 404 - no access to NPC)."""
        resp = self._auth_client(self.player_user).post(
            f"/api/npcs/{self.npc.id}/apply-effect/",
            {"effect": "standard", "clock_type": "vulnerability"},
            format="json",
        )
        self.assertIn(
            resp.status_code,
            (403, 404),
            "Player must not be able to apply effect to NPC",
        )

    def test_invalid_effect_returns_400(self):
        resp = self._auth_client(self.gm_user).post(
            f"/api/npcs/{self.npc.id}/apply-effect/",
            {"effect": "invalid", "clock_type": "vulnerability"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_non_vulnerability_clock_type_rejected(self):
        resp = self._auth_client(self.gm_user).post(
            f"/api/npcs/{self.npc.id}/apply-effect/",
            {"effect": "limited", "clock_type": "harm"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class NPCPutAbilitiesRegressionTest(TestCase):
    """Regression: PUT /api/npcs/{id}/ with ability descriptions must return 200, not 500."""

    def setUp(self):
        self.gm_user = User.objects.create_user(
            username="gm2", email="gm2@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Test Campaign", gm=self.gm_user)
        self.npc = NPC.objects.create(
            name="Lucy Brown",
            creator=self.gm_user,
            campaign=self.campaign,
            role="Treasure Hunter",
            stand_name="Corner Pocket",
            stand_coin_stats={
                "POWER": "D",
                "SPEED": "F",
                "DURABILITY": "B",
                "PRECISION": "B",
                "RANGE": "C",
                "DEVELOPMENT": "C",
            },
            abilities=[],
        )

    def _auth_client(self):
        c = APIClient()
        c.force_authenticate(user=self.gm_user)
        return c

    def test_put_npc_with_ability_description_returns_200(self):
        """PUT /api/npcs/{id}/ including abilities with description text must not return 500."""
        payload = {
            "name": "Lucy Brown",
            "role": "Treasure Hunter",
            "stand_name": "Corner Pocket",
            "stand_coin_stats": {
                "POWER": "D",
                "SPEED": "F",
                "DURABILITY": "B",
                "PRECISION": "B",
                "RANGE": "C",
                "DEVELOPMENT": "C",
            },
            "abilities": [
                {
                    # Frontend generates IDs as Date.now() timestamps; using a realistic value
                    # from the original bug report to exercise large integer handling.
                    "id": 1775836770466,
                    "name": "Pool Ball Transformation",
                    "type": "unique",
                    "description": (
                        "Lucy targets a person within C Range and transforms them into a giant pool ball. "
                        "While transformed, the target cannot take actions but is not harmed."
                    ),
                }
            ],
            "notes": "GM Note: Lucy is the most tactically interesting of this group.",
            "regular_armor_used": 0,
            "special_armor_used": 0,
            "vulnerability_clock_current": 0,
            "faction_status": {},
            "inventory": [],
            "contacts": [],
        }
        resp = self._auth_client().put(
            f"/api/npcs/{self.npc.id}/",
            payload,
            format="json",
        )
        self.assertIn(
            resp.status_code,
            (200, 204),
            f'Expected 200/204 but got {resp.status_code}: {getattr(resp, "data", resp.content)}',
        )

    def test_put_npc_ability_with_em_dash_returns_200(self):
        """Regression: ability description containing EM DASH (U+2014) and other non-ASCII
        typographic characters must save without error (was returning 500 in production).
        """
        # This is the exact text from the original bug report.
        # \u2014 = EM DASH (—), \u2019 = RIGHT SINGLE QUOTATION MARK ('),
        # \u201c/\u201d = LEFT/RIGHT DOUBLE QUOTATION MARK ("")
        em_dash_description = (
            "Lucy targets a person within C Range and transforms them into a giant pool ball "
            "(numbered, solid or striped \u2014 GM\u2019s choice, purely flavor). "  # — and '
            "While transformed, the target cannot take actions but is not harmed. "
            "They remain a pool ball until Lucy releases them, her clock fills, or a PC opens "
            "a 6-segment \u201cBreak the Spell\u201d clock. "  # " and "
            "Lucy can have up to 3 active pool balls at once."
        )
        payload = {
            "name": "Lucy Brown",
            "stand_coin_stats": {
                "POWER": "D",
                "SPEED": "F",
                "DURABILITY": "B",
                "PRECISION": "B",
                "RANGE": "C",
                "DEVELOPMENT": "C",
            },
            "abilities": [
                {
                    "id": 1775836770466,
                    "name": "Pool Ball Transformation",
                    "type": "unique",
                    "description": em_dash_description,
                }
            ],
            "regular_armor_used": 0,
            "special_armor_used": 0,
            "vulnerability_clock_current": 0,
            "faction_status": {},
            "inventory": [],
            "contacts": [],
        }
        resp = self._auth_client().put(
            f"/api/npcs/{self.npc.id}/",
            payload,
            format="json",
        )
        self.assertIn(
            resp.status_code,
            (200, 204),
            f'EM dash in ability description caused {resp.status_code}: {getattr(resp, "data", resp.content)}',
        )
        # Verify the description is preserved exactly in the response.
        self.npc.refresh_from_db()
        saved_desc = self.npc.abilities[0]["description"]
        self.assertEqual(saved_desc, em_dash_description)

    def test_put_npc_ability_with_curly_quote_slice_paste_returns_200(self):
        """Regression: exact user paste with curly quotes around slice must persist."""
        # \u201c/\u201d = LEFT/RIGHT DOUBLE QUOTATION MARK around "slice"
        paste_description = (
            "The needles build up stacks of \u201cslice,\u201d which allow the enemy "
            "to steal flesh and stand user abilities from others"
        )
        payload = {
            "name": "Lucy Brown",
            "stand_coin_stats": {
                "POWER": "D",
                "SPEED": "F",
                "DURABILITY": "B",
                "PRECISION": "B",
                "RANGE": "C",
                "DEVELOPMENT": "C",
            },
            "abilities": [
                {
                    "id": 1775836770999,
                    "name": "Needle Stacks",
                    "type": "unique",
                    "description": paste_description,
                }
            ],
            "regular_armor_used": 0,
            "special_armor_used": 0,
            "vulnerability_clock_current": 0,
            "faction_status": {},
            "inventory": [],
            "contacts": [],
        }
        resp = self._auth_client().put(
            f"/api/npcs/{self.npc.id}/",
            payload,
            format="json",
        )
        self.assertIn(
            resp.status_code,
            (200, 204),
            f'Curly-quote paste caused {resp.status_code}: {getattr(resp, "data", resp.content)}',
        )
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.abilities[0]["description"], paste_description)

    def test_put_npc_with_null_campaign_returns_200(self):
        """PUT /api/npcs/{id}/ with campaign=null must not raise AttributeError in __str__."""
        self.npc.campaign = None
        self.npc.save()
        payload = {
            "name": "Lucy Brown",
            "stand_coin_stats": {
                "POWER": "D",
                "SPEED": "F",
                "DURABILITY": "B",
                "PRECISION": "B",
                "RANGE": "C",
                "DEVELOPMENT": "C",
            },
            "abilities": [],
            "regular_armor_used": 0,
            "special_armor_used": 0,
            "vulnerability_clock_current": 0,
            "faction_status": {},
            "inventory": [],
            "contacts": [],
        }
        resp = self._auth_client().put(
            f"/api/npcs/{self.npc.id}/",
            payload,
            format="json",
        )
        self.assertIn(
            resp.status_code, (200, 204), f"Expected 200/204 but got {resp.status_code}"
        )

    def test_npc_str_with_null_campaign(self):
        """NPC.__str__ must not raise AttributeError when campaign is None."""
        self.npc.campaign = None
        self.npc.save()
        try:
            s = str(self.npc)
        except AttributeError as exc:
            self.fail(f"NPC.__str__ raised AttributeError with null campaign: {exc}")
        self.assertIn("no campaign", s)


class NPCHeritageSelectionTest(TestCase):
    """NPC selected_benefits / selected_detriments persist without PC HP budget rules."""

    def setUp(self):
        self.gm_user = User.objects.create_user(
            username="gm_herit", email="gm_herit@test.com", password="testpass"
        )
        self.campaign = Campaign.objects.create(name="Heritage Camp", gm=self.gm_user)
        self.heritage = Heritage.objects.create(
            name="Pillar Man Test", base_hp=2, description="Test heritage"
        )
        self.benefit = Benefit.objects.create(
            heritage=self.heritage,
            name="Hyper-Intelligence",
            description="Test benefit",
            required=False,
            hp_cost=1,
        )
        self.detriment = Detriment.objects.create(
            heritage=self.heritage,
            name="Sunlight Turns You to Stone",
            description="Test detriment",
            required=True,
            hp_value=1,
        )
        self.npc = NPC.objects.create(
            name="Kars",
            creator=self.gm_user,
            campaign=self.campaign,
            heritage=self.heritage,
            playbook="NON_BIZARRE",
            stand_coin_stats={},
        )

    def _auth_client(self):
        c = APIClient()
        c.force_authenticate(user=self.gm_user)
        return c

    def test_put_npc_selected_heritage_picks_persist(self):
        payload = {
            "name": "Kars",
            "heritage": self.heritage.id,
            "playbook": "NON_BIZARRE",
            "stand_coin_stats": {},
            "selected_benefits": [self.benefit.id],
            "selected_detriments": [self.detriment.id],
            "faction_status": {},
            "inventory": [],
            "contacts": [],
        }
        resp = self._auth_client().put(
            f"/api/npcs/{self.npc.id}/",
            payload,
            format="json",
        )
        self.assertIn(
            resp.status_code,
            (200, 204),
            f"Expected 200/204 but got {resp.status_code}: {getattr(resp, 'data', resp.content)}",
        )
        self.npc.refresh_from_db()
        self.assertEqual(
            list(self.npc.selected_benefits.values_list("id", flat=True)),
            [self.benefit.id],
        )
        self.assertEqual(
            list(self.npc.selected_detriments.values_list("id", flat=True)),
            [self.detriment.id],
        )
        self.assertEqual(resp.data.get("selected_benefits"), [self.benefit.id])
        self.assertEqual(resp.data.get("selected_detriments"), [self.detriment.id])

    def test_put_npc_can_clear_heritage_picks(self):
        self.npc.selected_benefits.set([self.benefit])
        self.npc.selected_detriments.set([self.detriment])
        payload = {
            "name": "Kars",
            "heritage": self.heritage.id,
            "playbook": "NON_BIZARRE",
            "stand_coin_stats": {},
            "selected_benefits": [],
            "selected_detriments": [],
            "faction_status": {},
            "inventory": [],
            "contacts": [],
        }
        resp = self._auth_client().put(
            f"/api/npcs/{self.npc.id}/",
            payload,
            format="json",
        )
        self.assertIn(resp.status_code, (200, 204), getattr(resp, "data", resp.content))
        self.npc.refresh_from_db()
        self.assertEqual(self.npc.selected_benefits.count(), 0)
        self.assertEqual(self.npc.selected_detriments.count(), 0)
