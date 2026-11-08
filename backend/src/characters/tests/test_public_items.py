"""Public (shared) equipment items, story S8 (user's rules, 2026-11-06).

- Anyone shares their own item: a player from their sheet, a GM from their
  campaign library. Sharing makes a SHARED copy; the source stays.
- A public item is off in every campaign until that campaign's GM ticks it.
- The creator (or staff) edits or unshares it. Unsharing hides it from new
  adds; the row is kept so sheet copies still point at it.
- Another GM edits by copying it into their own campaign library.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, CampaignEquipmentAccess, Character, EquipmentItem, Heritage

URL = "/api/equipment-items/"


class PublicItemBase(TestCase):
    def setUp(self):
        heritage, _ = Heritage.objects.get_or_create(name="Human", defaults={"base_hp": 0, "description": ""})
        self.gm = User.objects.create_user(username="sh_gm", password="pw-sh-gm-1")
        self.other_gm = User.objects.create_user(username="sh_other_gm", password="pw-sh-other-1")
        self.player = User.objects.create_user(username="sh_player", password="pw-sh-player-1")
        self.player2 = User.objects.create_user(username="sh_player2", password="pw-sh-player2-1")
        self.staff = User.objects.create_user(username="sh_staff", password="pw-sh-staff-1", is_staff=True)
        self.campaign = Campaign.objects.create(name="Share Camp", gm=self.gm)
        self.other_campaign = Campaign.objects.create(name="Other Share Camp", gm=self.other_gm)
        self.pc = Character.objects.create(
            user=self.player, campaign=self.campaign, true_name="Sharer PC", heritage=heritage
        )
        self.other_pc = Character.objects.create(
            user=self.player2, campaign=self.other_campaign, true_name="Other PC", heritage=heritage
        )
        self.library_item = EquipmentItem.objects.create(
            name="GM Lockpicks", scope="CAMPAIGN", campaign=self.campaign, created_by=self.gm
        )
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def share_sheet_item(self, user, character, name="Lucky Coin", **extra):
        body = {
            "name": name, "detail": "Shiny", "category": "gear",
            "load": 0, "quality": 0, "source_character": character.id, **extra,
        }
        return self.as_user(user).post(f"{URL}share/", body, format="json")

    def make_shared(self, name="Lucky Coin"):
        response = self.share_sheet_item(self.player, self.pc, name=name)
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))
        return EquipmentItem.objects.get(pk=response.data["id"])

    def available_names(self, user, campaign):
        """What the user's sheet in that campaign can add as homebrew. Since
        S10 that's the "Add owned homebrew item" picker, not Add Item."""
        character = Character.objects.filter(user=user, campaign=campaign).first()
        response = self.as_user(user).get(URL, {"homebrew": "owned", "character": character.id})
        self.assertEqual(response.status_code, 200)
        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        return {row["name"] for row in rows}


class PublicItemTests(PublicItemBase):
    # Sharing

    def test_a_player_shares_a_custom_item_from_their_own_sheet(self):
        item = self.make_shared()
        self.assertEqual(item.scope, "SHARED")
        self.assertTrue(item.is_public)
        self.assertIsNone(item.campaign_id)
        self.assertEqual(item.created_by, self.player)
        # Load 0 and quality 0 are kept, not bumped to 1.
        self.assertEqual((item.load_slots, item.quality), (0, 0))

    def test_nobody_shares_from_someone_elses_sheet(self):
        for user in (self.player2, self.other_gm):
            with self.subTest(user=user.username):
                response = self.share_sheet_item(user, self.pc, name="Stolen idea")
                self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.assertFalse(EquipmentItem.objects.filter(name="Stolen idea").exists())

    def test_the_gm_shares_a_library_item_and_the_library_item_stays(self):
        response = self.as_user(self.gm).post(f"{URL}share/", {"item": self.library_item.id}, format="json")
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))
        shared = EquipmentItem.objects.get(pk=response.data["id"])
        self.assertEqual((shared.scope, shared.name, shared.created_by), ("SHARED", "GM Lockpicks", self.gm))
        self.library_item.refresh_from_db()
        self.assertEqual(self.library_item.scope, "CAMPAIGN")

    def test_a_player_cannot_share_the_gms_library_item(self):
        response = self.as_user(self.player).post(f"{URL}share/", {"item": self.library_item.id}, format="json")
        self.assertIn(response.status_code, (403, 404), getattr(response, "data", None))
        self.assertFalse(EquipmentItem.objects.filter(scope="SHARED").exists())

    def test_sharing_the_same_name_again_returns_the_existing_item(self):
        first = self.make_shared()
        first.is_public = False
        first.save()
        response = self.share_sheet_item(self.player, self.pc, name="lucky coin")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.assertEqual(response.data["id"], first.id)
        first.refresh_from_db()
        self.assertTrue(first.is_public)
        self.assertEqual(EquipmentItem.objects.filter(scope="SHARED").count(), 1)

    def test_shared_items_cannot_be_made_through_plain_create_or_edit(self):
        response = self.as_user(self.player).post(URL, {"name": "Sneaky", "scope": "SHARED"}, format="json")
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        response = self.as_user(self.gm).patch(f"{URL}{self.library_item.id}/", {"scope": "SHARED"}, format="json")
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))

    # Campaign opt-in

    def test_a_public_item_is_off_until_the_gm_ticks_it(self):
        item = self.make_shared()
        self.assertNotIn(item.name, self.available_names(self.player2, self.other_campaign))

        response = self.as_user(self.other_gm).post(
            f"{URL}{item.id}/set-campaign-access/", {"campaign": self.other_campaign.id, "enabled": True}, format="json"
        )
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        self.assertIn(item.name, self.available_names(self.player2, self.other_campaign))

    def test_the_gms_list_shows_who_shared_it(self):
        item = self.make_shared()
        response = self.as_user(self.other_gm).get(URL, {"campaign": self.other_campaign.id})
        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        row = next(r for r in rows if r["id"] == item.id)
        self.assertEqual(row["created_by_username"], "sh_player")
        self.assertFalse(row["enabled_for_campaign"])

    # Unsharing

    def test_the_creator_unshares_and_it_leaves_new_adds_but_the_row_stays(self):
        item = self.make_shared()
        CampaignEquipmentAccess.objects.create(campaign=self.other_campaign, item=item, enabled=True)
        response = self.as_user(self.player).post(f"{URL}{item.id}/unshare/", {}, format="json")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        item.refresh_from_db()
        self.assertFalse(item.is_public)
        self.assertNotIn(item.name, self.available_names(self.player2, self.other_campaign))

    def test_an_unshared_item_is_hidden_from_other_users(self):
        item = self.make_shared()
        item.is_public = False
        item.save()
        response = self.as_user(self.player2).get(f"{URL}{item.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.as_user(self.player).get(f"{URL}{item.id}/").status_code, 200)

    def test_only_the_creator_or_staff_unshare(self):
        item = self.make_shared()
        for user in (self.player2, self.other_gm, self.gm):
            with self.subTest(user=user.username):
                response = self.as_user(user).post(f"{URL}{item.id}/unshare/", {}, format="json")
                self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        item.refresh_from_db()
        self.assertTrue(item.is_public)
        self.assertEqual(self.as_user(self.staff).post(f"{URL}{item.id}/unshare/", {}, format="json").status_code, 200)

    # Editing

    def test_the_creator_edits_and_others_cannot_edit_or_delete(self):
        item = self.make_shared()
        self.assertEqual(
            self.as_user(self.player).patch(f"{URL}{item.id}/", {"name": "Luckier Coin"}, format="json").status_code, 200
        )
        for user in (self.player2, self.other_gm):
            with self.subTest(user=user.username):
                self.assertEqual(
                    self.as_user(user).patch(f"{URL}{item.id}/", {"name": "Mine now"}, format="json").status_code, 403
                )
                self.assertEqual(self.as_user(user).delete(f"{URL}{item.id}/").status_code, 403)
        item.refresh_from_db()
        self.assertEqual(item.name, "Luckier Coin")

    def test_the_creator_cannot_flip_is_public_or_campaign_through_edit(self):
        item = self.make_shared()
        self.as_user(self.player).patch(f"{URL}{item.id}/", {"is_public": False}, format="json")
        item.refresh_from_db()
        self.assertTrue(item.is_public)
        response = self.as_user(self.player).patch(
            f"{URL}{item.id}/", {"campaign": self.campaign.id}, format="json"
        )
        self.assertEqual(response.status_code, 403, getattr(response, "data", None))

    def test_another_gm_copies_it_into_their_library_and_the_original_is_unchanged(self):
        item = self.make_shared()
        CampaignEquipmentAccess.objects.create(campaign=self.other_campaign, item=item, enabled=True)
        response = self.as_user(self.other_gm).post(
            f"{URL}{item.id}/copy-to-campaign/", {"campaign": self.other_campaign.id}, format="json"
        )
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))
        copy = EquipmentItem.objects.get(pk=response.data["id"])
        self.assertEqual((copy.scope, copy.campaign, copy.created_by), ("CAMPAIGN", self.other_campaign, self.other_gm))
        self.assertEqual(copy.name, "Lucky Coin")

        self.as_user(self.other_gm).patch(f"{URL}{copy.id}/", {"name": "House Coin"}, format="json")
        item.refresh_from_db()
        self.assertEqual(item.name, "Lucky Coin")
        # The original is switched off there, so the list doesn't show it twice.
        self.assertFalse(CampaignEquipmentAccess.objects.get(campaign=self.other_campaign, item=item).enabled)

    def test_only_that_campaigns_gm_copies_into_it(self):
        item = self.make_shared()
        for user in (self.player2, self.gm):
            with self.subTest(user=user.username):
                response = self.as_user(user).post(
                    f"{URL}{item.id}/copy-to-campaign/", {"campaign": self.other_campaign.id}, format="json"
                )
                self.assertEqual(response.status_code, 403, getattr(response, "data", None))
        self.assertFalse(EquipmentItem.objects.filter(campaign=self.other_campaign).exists())

    def test_my_shared_items_lists_only_mine_including_unshared(self):
        mine = self.make_shared()
        mine.is_public = False
        mine.save()
        self.as_user(self.player2).post(
            f"{URL}share/",
            {"name": "Not mine", "source_character": self.other_pc.id},
            format="json",
        )
        response = self.as_user(self.player).get(URL, {"scope": "SHARED", "mine": 1})
        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertEqual([r["id"] for r in rows], [mine.id])


class MakeHomebrewTests(PublicItemBase):
    """S8 Make homebrew (user's rules, 2026-11-07).

    - "Save as homebrew" keeps an item private (My creations only).
      "Publish as homebrew" makes it public.
    - Homebrew can also be made from scratch or from a template (an SRD item
      or a public homebrew item). The template is never changed.
    - Only the creator or staff publishes or unpublishes.
    """

    def browse_ids(self, user):
        response = self.as_user(user).get(URL, {"scope": "SHARED"})
        rows = response.data["results"] if isinstance(response.data, dict) else response.data
        return {row["id"] for row in rows}

    def test_save_as_homebrew_is_private(self):
        response = self.share_sheet_item(self.player, self.pc, public=False)
        self.assertEqual(response.status_code, 201, response.data)
        item = EquipmentItem.objects.get(pk=response.data["id"])
        self.assertFalse(item.is_public)
        self.assertNotIn(item.id, self.browse_ids(self.player2))
        self.assertIn(item.id, self.browse_ids(self.player))

    def test_publishing_a_saved_item_publishes_the_same_row(self):
        saved = self.share_sheet_item(self.player, self.pc, public=False).data["id"]
        published = self.share_sheet_item(self.player, self.pc, public=True)
        self.assertEqual(published.data["id"], saved)
        self.assertTrue(EquipmentItem.objects.get(pk=saved).is_public)

    def test_saving_again_does_not_unpublish(self):
        item = self.make_shared()
        again = self.share_sheet_item(self.player, self.pc, public=False)
        self.assertEqual(again.data["id"], item.id)
        item.refresh_from_db()
        self.assertTrue(item.is_public)

    def test_create_from_scratch(self):
        response = self.as_user(self.player2).post(
            f"{URL}share/",
            {"name": "Scratch Lamp", "category": "gear", "load": 0, "quality": 2, "public": False},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = EquipmentItem.objects.get(pk=response.data["id"])
        self.assertEqual(
            (item.scope, item.created_by, item.is_public, item.load_slots, item.quality, item.campaign_id),
            ("SHARED", self.player2, False, 0, 2, None),
        )

    def test_create_from_a_template_leaves_the_template_unchanged(self):
        srd = EquipmentItem.objects.create(
            name="Crowbar", description="SRD kit", category="tools", load_slots=1, quality=1, scope="TEMPLATE"
        )
        response = self.as_user(self.player).post(
            f"{URL}share/", {"template": srd.id, "name": "Bent Crowbar", "public": False}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        item = EquipmentItem.objects.get(pk=response.data["id"])
        self.assertEqual((item.name, item.description, item.category), ("Bent Crowbar", "SRD kit", "tools"))
        srd.refresh_from_db()
        self.assertEqual((srd.name, srd.scope, srd.created_by_id), ("Crowbar", "TEMPLATE", None))

    def test_a_private_item_cannot_be_used_as_someone_elses_template(self):
        private = self.share_sheet_item(self.player, self.pc, public=False).data["id"]
        response = self.as_user(self.player2).post(
            f"{URL}share/", {"template": private, "name": "Stolen"}, format="json"
        )
        self.assertIn(response.status_code, (403, 404))
        self.assertFalse(EquipmentItem.objects.filter(name="Stolen").exists())

    def test_publish_and_unpublish_by_the_creator_only(self):
        item_id = self.share_sheet_item(self.player, self.pc, public=False).data["id"]
        for user in (self.player2, self.gm):
            with self.subTest(user=user.username):
                self.assertEqual(self.as_user(user).post(f"{URL}{item_id}/publish/").status_code, 404)
        self.assertEqual(self.as_user(self.player).post(f"{URL}{item_id}/publish/").status_code, 200)
        self.assertTrue(EquipmentItem.objects.get(pk=item_id).is_public)
        self.assertEqual(self.as_user(self.player2).post(f"{URL}{item_id}/unpublish/").status_code, 403)
        self.assertEqual(self.as_user(self.player).post(f"{URL}{item_id}/unpublish/").status_code, 200)
        self.assertFalse(EquipmentItem.objects.get(pk=item_id).is_public)

    def test_staff_items_show_by_admin_and_rows_say_if_they_are_mine(self):
        EquipmentItem.objects.create(name="Old Site Hook", scope="SITE")
        self.make_shared()
        response = self.as_user(self.player).get(URL)
        rows = {r["name"]: r for r in (response.data["results"] if isinstance(response.data, dict) else response.data)}
        self.assertEqual(rows["Old Site Hook"]["created_by_username"], "admin")
        self.assertFalse(rows["Old Site Hook"]["is_mine"])
        self.assertTrue(rows["Lucky Coin"]["is_mine"])
