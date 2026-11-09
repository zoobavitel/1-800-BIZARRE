"""S11 Homebrew switch (user's rules, 2026-11-07 and 2026-11-08).

- Every campaign has "Enable homebrew", off by default, set by its GM.
  While it's off, no sheet in the campaign gets homebrew: the "Add owned
  homebrew item" list is empty.
- On, it works like D&D Beyond's campaign content sharing: everyone in the
  campaign shares one pool, the homebrew any member (GM or player) made or
  saved to their collection. Not the whole public catalog, and no block
  list: the table agrees what to use.
- A sheet with no campaign has its own switch, off by default, set by its
  owner, and gets only the owner's homebrew.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    Character,
    EquipmentItem,
    Heritage,
    HomebrewCollectionEntry,
)

URL = "/api/equipment-items/"


def rows(response):
    return response.data["results"] if isinstance(response.data, dict) else response.data


class HomebrewSwitchTests(TestCase):
    def setUp(self):
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.gm = User.objects.create_user(username="hs_gm", password="pw-hs-gm-1")
        self.player = User.objects.create_user(username="hs_player", password="pw-hs-player-1")
        self.other = User.objects.create_user(username="hs_other", password="pw-hs-other-1")
        self.campaign = Campaign.objects.create(name="Switch Camp", gm=self.gm)
        self.campaign.players.add(self.player)
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, true_name="Switch PC", heritage=heritage
        )
        self.solo = Character.objects.create(user=self.player, true_name="Solo PC", heritage=heritage)
        self.coin = EquipmentItem.objects.create(
            name="Player Coin", scope="SHARED", is_public=False, created_by=self.player
        )
        self.charm = EquipmentItem.objects.create(
            name="GM Charm", scope="SHARED", is_public=False, created_by=self.gm
        )
        # Another player in the campaign, with their own homebrew.
        mate = User.objects.create_user(username="hs_mate", password="pw-hs-mate-1")
        self.campaign.players.add(mate)
        EquipmentItem.objects.create(name="Mate Lamp", scope="SHARED", is_public=False, created_by=mate)
        # Published homebrew from outside: only in the pool once a member saves it.
        saved = EquipmentItem.objects.create(
            name="Saved Hook", scope="SHARED", is_public=True, created_by=self.other
        )
        HomebrewCollectionEntry.objects.create(user=mate, item=saved)
        EquipmentItem.objects.create(name="Stranger Rope", scope="SHARED", is_public=True, created_by=self.other)
        EquipmentItem.objects.create(name="Stranger Secret", scope="SHARED", is_public=False, created_by=self.other)
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def owned(self, character, user=None):
        response = self.as_user(user or self.player).get(URL, {"homebrew": "owned", "character": character.id})
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        return {r["name"] for r in rows(response)}

    def switch_campaign(self, user, value):
        return self.as_user(user).patch(
            f"/api/campaigns/{self.campaign.id}/", {"homebrew_enabled": value}, format="json"
        )

    def switch_sheet(self, user, character, value):
        return self.as_user(user).patch(
            f"/api/characters/{character.id}/", {"homebrew_enabled": value}, format="json"
        )

    # Defaults and who flips them

    def test_both_switches_start_off(self):
        self.assertFalse(Campaign.objects.create(name="New", gm=self.gm).homebrew_enabled)
        self.assertFalse(self.solo.homebrew_enabled)
        response = self.as_user(self.gm).get(f"/api/campaigns/{self.campaign.id}/")
        self.assertIs(response.data["homebrew_enabled"], False)

    def test_only_the_gm_flips_the_campaign_switch(self):
        self.assertEqual(self.switch_campaign(self.player, True).status_code, 403)
        self.campaign.refresh_from_db()
        self.assertFalse(self.campaign.homebrew_enabled)
        self.assertEqual(self.switch_campaign(self.gm, True).status_code, 200)
        self.campaign.refresh_from_db()
        self.assertTrue(self.campaign.homebrew_enabled)

    def test_only_the_owner_flips_a_sheet_switch(self):
        self.assertIn(self.switch_sheet(self.other, self.solo, True).status_code, (403, 404))
        self.solo.refresh_from_db()
        self.assertFalse(self.solo.homebrew_enabled)
        response = self.switch_sheet(self.player, self.solo, True)
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.solo.refresh_from_db()
        self.assertTrue(self.solo.homebrew_enabled)

    def test_the_sheet_reports_its_campaigns_switch(self):
        self.campaign.homebrew_enabled = True
        self.campaign.save()
        response = self.as_user(self.player).get(f"/api/characters/{self.pc.id}/")
        self.assertIs(response.data["campaign_homebrew_enabled"], True)
        response = self.as_user(self.player).get(f"/api/characters/{self.solo.id}/")
        self.assertIsNone(response.data["campaign_homebrew_enabled"])

    # The switch gates the sheet's homebrew list

    def test_campaign_off_means_no_homebrew(self):
        self.assertEqual(self.owned(self.pc), set())

    def test_campaign_on_shares_every_members_homebrew(self):
        self.campaign.homebrew_enabled = True
        self.campaign.save()
        self.assertEqual(self.owned(self.pc), {"Player Coin", "GM Charm", "Mate Lamp", "Saved Hook"})

    def test_the_pool_is_not_the_whole_public_catalog(self):
        self.campaign.homebrew_enabled = True
        self.campaign.save()
        names = self.owned(self.pc)
        self.assertNotIn("Stranger Rope", names)
        self.assertNotIn("Stranger Secret", names)

    def test_in_a_campaign_the_sheets_own_switch_does_not_count(self):
        self.pc.homebrew_enabled = True
        self.pc.save()
        self.assertEqual(self.owned(self.pc), set())

    def test_no_campaign_sheet_gets_only_its_owners_homebrew(self):
        self.assertEqual(self.owned(self.solo), set())
        self.solo.homebrew_enabled = True
        self.solo.save()
        self.assertEqual(self.owned(self.solo), {"Player Coin"})

    def test_there_is_no_per_item_block(self):
        response = self.as_user(self.gm).post(
            f"{URL}{self.coin.id}/set-campaign-access/",
            {"campaign": self.campaign.id, "enabled": False},
            format="json",
        )
        self.assertIn(response.status_code, (400, 404))

    # The campaign card list

    def test_members_see_the_campaigns_pool(self):
        for user in (self.gm, self.player):
            with self.subTest(user=user.username):
                response = self.as_user(user).get(URL, {"homebrew": "campaign", "campaign": self.campaign.id})
                self.assertEqual(response.status_code, 200, getattr(response, "data", None))
                self.assertEqual(
                    {r["name"] for r in rows(response)},
                    {"Player Coin", "GM Charm", "Mate Lamp", "Saved Hook"},
                )

    def test_outsiders_cannot_read_the_pool(self):
        response = self.as_user(self.other).get(URL, {"homebrew": "campaign", "campaign": self.campaign.id})
        self.assertEqual(response.status_code, 403)
