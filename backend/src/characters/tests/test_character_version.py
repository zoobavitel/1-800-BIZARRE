"""Character.version: bumped on every write, checked on sheet PATCHes (PR 7a)."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from characters.models import (
    Ability,
    Benefit,
    Character,
    Heritage,
    ProgressClock,
    Stand,
)


def stored_version(character):
    return Character.objects.values_list("version", flat=True).get(pk=character.pk)


class VersionBumpTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ver_user", password="x")
        self.ch = Character.objects.create(user=self.user, true_name="Versioned")

    def test_new_character_starts_at_one(self):
        self.assertEqual(self.ch.version, 1)
        self.assertEqual(stored_version(self.ch), 1)

    def test_save_bumps_and_leaves_an_int_on_the_instance(self):
        self.ch.background_note = "x"
        self.ch.save()
        self.assertEqual(self.ch.version, 2)
        self.assertIsInstance(self.ch.version, int)
        self.assertEqual(stored_version(self.ch), 2)

    def test_save_with_update_fields_bumps(self):
        self.ch.stress = 3
        self.ch.save(update_fields=["stress"])
        self.assertEqual(stored_version(self.ch), 2)
        self.assertEqual(self.ch.version, 2)

    def test_save_with_empty_update_fields_stays_a_no_op(self):
        self.ch.save(update_fields=[])
        self.assertEqual(stored_version(self.ch), 1)

    def test_queryset_update_bumps(self):
        Character.objects.filter(pk=self.ch.pk).update(stress=4)
        self.assertEqual(stored_version(self.ch), 2)

    def test_bulk_update_is_refused(self):
        self.ch.stress = 5
        with self.assertRaises(NotImplementedError):
            Character.objects.bulk_update([self.ch], ["stress"])

    def test_stale_instance_save_still_bumps_past_other_writes(self):
        other = Character.objects.get(pk=self.ch.pk)
        other.stress = 1
        other.save()
        self.ch.background_note = "late"
        self.ch.save()
        self.assertEqual(stored_version(self.ch), 3)

    def test_stand_write_bumps_and_refreshes_the_loaded_character(self):
        stand = Stand.objects.create(character=self.ch, name="Echoes")
        after_create = stored_version(self.ch)
        self.assertGreater(after_create, 1)
        self.assertEqual(self.ch.version, after_create)
        stand.name = "Echoes Act 2"
        stand.save()
        self.assertEqual(stored_version(self.ch), after_create + 1)

    def test_standard_ability_m2m_bumps(self):
        ability = Ability.objects.create(name="Ability X", type="standard", description="")
        self.ch.standard_abilities.add(ability)
        self.assertEqual(stored_version(self.ch), 2)
        self.assertEqual(self.ch.version, 2)
        self.ch.standard_abilities.remove(ability)
        self.assertEqual(stored_version(self.ch), 3)

    def test_reverse_m2m_add_bumps_the_named_character(self):
        heritage = Heritage.objects.create(name="Ver Heritage", base_hp=0, description="")
        benefit = Benefit.objects.create(
            heritage=heritage, name="B", hp_cost=0, description=""
        )
        benefit.characters.add(self.ch)
        self.assertEqual(stored_version(self.ch), 2)

    def test_character_clock_bumps_and_other_clocks_do_not(self):
        clock = ProgressClock.objects.create(
            character=self.ch, name="Heal", clock_type="other", max_segments=4
        )
        self.assertEqual(stored_version(self.ch), 2)
        clock.delete()
        self.assertEqual(stored_version(self.ch), 3)
        ProgressClock.objects.create(name="Loose", clock_type="other", max_segments=4)
        self.assertEqual(stored_version(self.ch), 3)


class VersionCheckApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("ver_owner", password="x")
        heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.ch = Character.objects.create(
            user=self.owner, true_name="Checked", heritage=heritage
        )
        self.url = f"/api/characters/{self.ch.pk}/"
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def patch(self, body, client=None):
        return (client or self.client).patch(self.url, body, format="json")

    def test_matching_version_saves_and_replies_with_the_stored_version(self):
        r = self.patch({"background_note": "fresh", "version": 1})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertGreater(r.json()["version"], 1)
        self.assertEqual(r.json()["version"], stored_version(self.ch))
        self.ch.refresh_from_db()
        self.assertEqual(self.ch.background_note, "fresh")

    def test_reply_version_works_for_the_next_save(self):
        v = self.patch({"background_note": "one", "version": 1}).json()["version"]
        r = self.patch({"background_note": "two", "version": v})
        self.assertEqual(r.status_code, 200, r.content)

    def test_stale_version_gets_409_with_the_current_row_and_writes_nothing(self):
        Character.objects.filter(pk=self.ch.pk).update(background_note="newer")
        r = self.patch({"background_note": "stale tab", "version": 1})
        self.assertEqual(r.status_code, 409, r.content)
        body = r.json()
        self.assertEqual(body["code"], "version_conflict")
        self.assertEqual(body["current"]["background_note"], "newer")
        self.assertEqual(body["current"]["version"], stored_version(self.ch))
        self.ch.refresh_from_db()
        self.assertEqual(self.ch.background_note, "newer")

    def test_two_saves_with_the_same_version_only_one_wins(self):
        first = self.patch({"background_note": "a", "version": 1})
        second = self.patch({"background_note": "b", "version": 1})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.ch.refresh_from_db()
        self.assertEqual(self.ch.background_note, "a")

    def test_save_without_version_is_accepted(self):
        Character.objects.filter(pk=self.ch.pk).update(background_note="newer")
        r = self.patch({"background_note": "old tab"})
        self.assertEqual(r.status_code, 200, r.content)

    def test_full_sheet_save_without_version_is_logged(self):
        with self.assertLogs("characters.views.character_views", level="INFO") as logs:
            self.patch({"true_name": "Checked", "background_note": "x"})
        self.assertTrue(
            any("sheet save without version" in line for line in logs.output)
        )

    def test_one_field_save_without_version_is_not_logged(self):
        with self.assertNoLogs("characters.views.character_views", level="INFO"):
            self.patch({"background_note": "x"})

    def test_bad_version_gets_400(self):
        r = self.patch({"background_note": "x", "version": "abc"})
        self.assertEqual(r.status_code, 400)

    def test_failed_validation_does_not_burn_the_version(self):
        r = self.patch({"true_name": "", "version": 1})
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(stored_version(self.ch), 1)

    def test_non_editor_gets_403_not_the_row(self):
        stranger = User.objects.create_user("ver_stranger", password="x")
        c = APIClient()
        c.force_authenticate(stranger)
        r = self.patch({"background_note": "x", "version": 1}, client=c)
        self.assertIn(r.status_code, (403, 404))
        self.assertNotIn("current", r.json())

    def test_stand_edit_reply_carries_the_final_version(self):
        r = self.patch({"stand": {"name": "Gold Experience"}, "version": 1})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["version"], stored_version(self.ch))

    def test_version_in_body_is_not_writable(self):
        r = self.patch({"background_note": "x", "version": 1})
        self.assertEqual(r.status_code, 200)
        self.assertNotEqual(r.json()["version"], 1)
