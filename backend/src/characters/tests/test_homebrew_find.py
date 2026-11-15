"""S9 Find homebrew (user's rules, 2026-11-07).

- Browse lists published homebrew only: public SHARED items and staff-made
  SITE items. It searches name and description.
- Anyone adds a published item, or their own, to their collection. Nobody
  collects someone else's private item.
- My creations lists my homebrew, private or published.
- The site search bar finds published homebrew, never private homebrew.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import Campaign, EquipmentItem, HomebrewCollectionEntry

URL = "/api/equipment-items/"


def rows(response):
    return response.data["results"] if isinstance(response.data, dict) else response.data


class FindHomebrewTests(TestCase):
    def setUp(self):
        self.maker = User.objects.create_user(username="fh_maker", password="pw-fh-maker-1")
        self.finder = User.objects.create_user(username="fh_finder", password="pw-fh-finder-1")
        self.gm = User.objects.create_user(username="fh_gm", password="pw-fh-gm-1")
        campaign = Campaign.objects.create(name="Find Camp", gm=self.gm)
        self.published = EquipmentItem.objects.create(
            name="Odd Lantern", description="Glows near Stands", scope="SHARED",
            is_public=True, created_by=self.maker,
        )
        self.private = EquipmentItem.objects.create(
            name="Secret Lantern", scope="SHARED", is_public=False, created_by=self.maker,
        )
        self.staff_item = EquipmentItem.objects.create(name="Grappling Hook", scope="SITE")
        self.srd = EquipmentItem.objects.create(name="Lantern", scope="TEMPLATE")
        self.library = EquipmentItem.objects.create(
            name="Library Lantern", scope="CAMPAIGN", campaign=campaign, created_by=self.gm,
        )
        self.client = APIClient()

    def get(self, user, **params):
        self.client.force_authenticate(user)
        response = self.client.get(URL, params)
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        return {r["name"] for r in rows(response)}

    def post(self, user, path):
        self.client.force_authenticate(user)
        return self.client.post(f"{URL}{path}")

    # Browse

    def test_browse_lists_published_homebrew_only(self):
        self.assertEqual(self.get(self.finder, homebrew="browse"), {"Odd Lantern", "Grappling Hook"})

    def test_browse_hides_my_own_private_items_too(self):
        self.assertNotIn("Secret Lantern", self.get(self.maker, homebrew="browse"))

    def test_browse_searches_name_and_description(self):
        self.assertEqual(self.get(self.finder, homebrew="browse", q="stands"), {"Odd Lantern"})
        self.assertEqual(self.get(self.finder, homebrew="browse", q="hook"), {"Grappling Hook"})

    def test_my_creations_lists_mine_private_or_published(self):
        self.assertEqual(self.get(self.maker, homebrew="mine"), {"Odd Lantern", "Secret Lantern"})
        self.assertEqual(self.get(self.finder, homebrew="mine"), set())

    # Collection

    def test_collect_and_uncollect_a_published_item(self):
        self.assertEqual(self.post(self.finder, f"{self.published.id}/collect/").status_code, 200)
        self.assertEqual(self.get(self.finder, homebrew="collection"), {"Odd Lantern"})
        self.client.force_authenticate(self.finder)
        row = rows(self.client.get(URL, {"homebrew": "browse"}))
        self.assertTrue(next(r for r in row if r["name"] == "Odd Lantern")["in_my_collection"])
        self.assertEqual(self.post(self.finder, f"{self.published.id}/uncollect/").status_code, 200)
        self.assertEqual(self.get(self.finder, homebrew="collection"), set())

    def test_collecting_twice_keeps_one_entry(self):
        self.post(self.finder, f"{self.staff_item.id}/collect/")
        self.post(self.finder, f"{self.staff_item.id}/collect/")
        self.assertEqual(HomebrewCollectionEntry.objects.filter(user=self.finder).count(), 1)

    def test_nobody_collects_someone_elses_private_item(self):
        response = self.post(self.finder, f"{self.private.id}/collect/")
        self.assertIn(response.status_code, (403, 404))
        self.assertFalse(HomebrewCollectionEntry.objects.filter(user=self.finder).exists())

    def test_srd_and_library_items_are_not_homebrew(self):
        for item in (self.srd, self.library):
            with self.subTest(item=item.name):
                self.client.force_authenticate(self.gm)
                response = self.client.post(f"{URL}{item.id}/collect/")
                self.assertEqual(response.status_code, 400, getattr(response, "data", None))

    def test_an_unpublished_item_leaves_other_collections_but_the_entry_stays(self):
        self.post(self.finder, f"{self.published.id}/collect/")
        self.published.is_public = False
        self.published.save()
        self.assertEqual(self.get(self.finder, homebrew="collection"), set())
        self.assertTrue(HomebrewCollectionEntry.objects.filter(user=self.finder, item=self.published).exists())

    # Site search

    def test_site_search_finds_published_homebrew_only(self):
        self.client.force_authenticate(self.finder)
        response = self.client.get("/api/search/", {"q": "lantern"})
        self.assertEqual(response.status_code, 200)
        homebrew = [r for r in response.data["results"] if r["type"] == "homebrew_item"]
        self.assertEqual([r["title"] for r in homebrew], ["Odd Lantern"])
        self.assertIn("fh_maker", homebrew[0]["subtitle"])
