"""S10 Use homebrew (user's rules, 2026-11-07).

- Add to a character: put one of my homebrew items, or one in my
  collection, on one of my own sheets.
- A sheet's "Add owned homebrew item" lists the owner's creations and
  collection. In a campaign with homebrew on, it lists the whole table's
  pool (S11), so the GM's homebrew is there too.
- Add Item no longer mixes in homebrew: it's SRD plus the campaign library.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Campaign,
    CampaignEquipmentAccess,
    Character,
    EquipmentItem,
    Heritage,
    HomebrewCollectionEntry,
)

URL = "/api/equipment-items/"


def rows(response):
    return response.data["results"] if isinstance(response.data, dict) else response.data


class UseHomebrewTests(TestCase):
    def setUp(self):
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.gm = User.objects.create_user(username="uh_gm", password="pw-uh-gm-1")
        self.player = User.objects.create_user(username="uh_player", password="pw-uh-player-1")
        self.other = User.objects.create_user(username="uh_other", password="pw-uh-other-1")
        # S11: homebrew needs the campaign's switch on.
        self.campaign = Campaign.objects.create(name="Use Camp", gm=self.gm, homebrew_enabled=True)
        self.campaign.players.add(self.player)
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, true_name="Use PC", heritage=heritage
        )
        self.other_pc = Character.objects.create(user=self.other, true_name="Other PC", heritage=heritage)

        self.my_private = self.homebrew("My Coin", self.player, public=False)
        self.my_public = self.homebrew("My Lantern", self.player, public=True)
        self.others_public = self.homebrew("Their Hook", self.other, public=True)
        self.others_private = self.homebrew("Their Secret", self.other, public=False)
        self.gm_item = self.homebrew("GM Charm", self.gm, public=False)
        self.staff_item = EquipmentItem.objects.create(name="Admin Rope", scope="SITE")
        self.srd = EquipmentItem.objects.create(name="Crowbar", scope="TEMPLATE")
        HomebrewCollectionEntry.objects.create(user=self.player, item=self.others_public)
        self.client = APIClient()

    @staticmethod
    def homebrew(name, user, public):
        return EquipmentItem.objects.create(name=name, scope="SHARED", is_public=public, created_by=user)

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def owned(self, user, character):
        response = self.as_user(user).get(URL, {"homebrew": "owned", "character": character.id})
        return response, {r["name"]: r.get("homebrew_source") for r in rows(response)} if response.status_code == 200 else {}

    def turn_on(self, item, enabled=True):
        CampaignEquipmentAccess.objects.update_or_create(
            campaign=self.campaign, item=item, defaults={"enabled": enabled}
        )

    # Add to a character

    def test_add_my_own_private_item_to_my_sheet(self):
        response = self.as_user(self.player).post(
            f"{URL}{self.my_private.id}/add-to-character/", {"character": self.pc.id}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.pc.refresh_from_db()
        row = self.pc.inventory[-1]
        self.assertEqual((row["name"], row["catalog_id"]), ("My Coin", self.my_private.id))
        self.assertTrue(row["id"])

    def test_add_a_collected_item_to_my_sheet(self):
        response = self.as_user(self.player).post(
            f"{URL}{self.others_public.id}/add-to-character/", {"character": self.pc.id}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_cannot_add_to_someone_elses_sheet(self):
        response = self.as_user(self.player).post(
            f"{URL}{self.my_public.id}/add-to-character/", {"character": self.other_pc.id}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.other_pc.refresh_from_db()
        self.assertEqual(self.other_pc.inventory, [])

    def test_cannot_add_someone_elses_private_item(self):
        response = self.as_user(self.player).post(
            f"{URL}{self.others_private.id}/add-to-character/", {"character": self.pc.id}, format="json"
        )
        self.assertIn(response.status_code, (403, 404))
        self.pc.refresh_from_db()
        self.assertEqual(self.pc.inventory, [])

    def test_only_homebrew_is_added_this_way(self):
        response = self.as_user(self.player).post(
            f"{URL}{self.srd.id}/add-to-character/", {"character": self.pc.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    # Add owned homebrew item (sheet picker)

    def test_picker_lists_my_creations_and_collection(self):
        response, names = self.owned(self.player, self.pc)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            {k: v for k, v in names.items() if v == "mine"},
            {"My Coin": "mine", "My Lantern": "mine", "Their Hook": "mine"},
        )

    def test_picker_adds_the_gms_homebrew_from_the_campaign_pool(self):
        _, names = self.owned(self.player, self.pc)
        self.assertEqual(names["GM Charm"], "campaign")

    def test_picker_never_lists_an_outsiders_private_item(self):
        _, names = self.owned(self.player, self.pc)
        self.assertNotIn("Their Secret", names)
        self.assertNotIn("Admin Rope", names)

    def test_the_gm_viewing_a_players_sheet_sees_the_players_list(self):
        response, names = self.owned(self.gm, self.pc)
        self.assertEqual(response.status_code, 200)
        self.assertIn("My Coin", names)

    def test_a_stranger_cannot_read_someone_elses_picker(self):
        response, _ = self.owned(self.other, self.pc)
        self.assertEqual(response.status_code, 403)

    # Add Item

    def test_add_item_no_longer_lists_homebrew(self):
        response = self.as_user(self.player).get(
            URL, {"campaign": self.campaign.id, "available_for_campaign": 1}
        )
        names = {r["name"] for r in rows(response)}
        self.assertIn("Crowbar", names)
        self.assertFalse({"GM Charm", "Admin Rope"} & names)

    # Staff get no exception on the site (2026-11-08).

    def test_staff_cannot_read_a_sheets_homebrew_or_add_to_it(self):
        staff = User.objects.create_user(username="uh_staff", password="pw-uh-staff-1", is_staff=True)
        response, _ = self.owned(staff, self.pc)
        self.assertEqual(response.status_code, 403)
        response = self.as_user(staff).post(
            f"{URL}{self.my_public.id}/add-to-character/", {"character": self.pc.id}, format="json"
        )
        self.assertEqual(response.status_code, 403)
