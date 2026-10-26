"""Every API write, tried as someone who shouldn't be able to make it.

The router registry is walked, so a new route or action is covered the day
it is added. Each write (list POST, detail PUT/PATCH/DELETE, and every
non-GET @action) is sent as two actors:

- stranger: signed in, with no tie to the campaign;
- member: a player in the campaign, with their own PC in the crew, who does
  not own the object being written.

Every request gets a brand-new stranger or member, made inside that request's
savepoint, so one write can't change what the next actor sees.

Each route also gets a positive control: an actor who should be allowed
(usually the GM) must not get 404 or 405. That proves the URL and the target
are real, so "closed" can't come from a typo.

Each response is sorted into a class:

- closed: 401, 403, 404 or 405 (refused);
- open: 2xx or 3xx (the write went through);
- invalid: another 4xx, usually a 400 from validation that ran before any
  permission check, so the result says nothing either way. A 400 whose body
  holds a known refusal (REFUSAL_MESSAGES) counts as closed;
- error: 5xx.

Every write must come out "closed" unless EXPECTED says otherwise, with a
reason. EXPECTED holds three kinds of entry:

- KNOWN HOLE: open today, fixed by a named PR. The PR removes its entry.
- BY DESIGN: open on purpose, with the reason.
- INCONCLUSIVE: invalid, with the reason and the test that covers it.

A fixed hole that is still listed fails too, so the list can't go stale.
Each request runs in a rolled-back savepoint, so one write can't change what
the next one sees.

To print the actual matrix (for updating EXPECTED):
    PERM_MATRIX_DUMP=1 python manage.py test characters.tests.test_permission_matrix
"""

import json
import os
import re

from django.contrib.auth.models import User
from django.db import transaction
from django.test import TestCase
from rest_framework.test import APIClient

from app.urls import router
from characters.models import (
    AdvancementPlanItem,
    Campaign,
    CampaignInvitation,
    Character,
    CharacterHistory,
    Crew,
    CrewHistory,
    EquipmentItem,
    ExperienceTracker,
    Faction,
    GroupAction,
    Heritage,
    NPC,
    ProgressClock,
    Roll,
    Session,
    ShowcasedNPC,
    UserProfile,
    XPHistory,
)

CLOSED, OPEN, INVALID, ERROR = "closed", "open", "invalid", "error"
ACTORS = ("stranger", "member")
READ_METHODS = {"GET", "HEAD", "OPTIONS"}


# A 400 carrying one of these is a refusal, not a validation error.
REFUSAL_MESSAGES = (
    "You cannot edit this character",
    "Only the campaign GM can",
    "Only this character's player or the GM",
    "Not a GM award you made",
    "You are not a member of this crew",
    "You can only add a character to a campaign you're in",
)


def classify(code, body=""):
    if code in (401, 403, 404, 405):
        return CLOSED
    if code == 400 and any(msg in body for msg in REFUSAL_MESSAGES):
        return CLOSED
    if 200 <= code < 400:
        return OPEN
    if code >= 500:
        return ERROR
    return INVALID


def _both(method, template, cls, reason):
    return {f"{method} {template} as {actor}": (cls, reason) for actor in ACTORS}


# key: "<METHOD> <url template> as <actor>" -> (class, reason)
EXPECTED = {
    # KNOWN HOLES. Each fix PR deletes its own entries.
    "DELETE /api/crews/{id}/ as member": (OPEN, "KNOWN HOLE, S5: any campaign member can delete the crew"),
    "POST /api/npcs/ as stranger": (OPEN, "KNOWN HOLE, S5: an NPC can be created inside a campaign you're not in"),
    "POST /api/progress-clocks/ as member": (OPEN, "KNOWN HOLE, S6: a member can bind a clock to another player's PC"),
    **_both("POST", "/api/equipment-items/", OPEN, "KNOWN HOLE, S7: anyone can create a global TEMPLATE item"),
    "POST /api/npcs/ as member": (OPEN, "KNOWN HOLE, S5: players may not create NPCs in a campaign; only its GM (user, 2026-10-26)"),
    **_both("POST", "/api/user-profiles/", ERROR, "KNOWN BUG, D: a second profile hits the unique constraint (500)"),

    # BY DESIGN.
    **_both("POST", "/api/campaigns/", OPEN, "BY DESIGN: anyone may create their own campaign and becomes its GM"),
    "POST /api/characters/ as member": (OPEN, "BY DESIGN: a player may add a PC to a campaign they play in"),
    "POST /api/crews/ as member": (OPEN, "BY DESIGN: a player may create a crew in their campaign"),
    "PATCH /api/crews/{id}/ as member": (OPEN, "BY DESIGN: crew members edit name, stash, description, notes and upgrade progress; level, xp, coin, rep, hold, turf and wanted_level become GM only in S5 (see test_member_crew_stat_patch)"),
    "POST /api/crews/{id}/propose-name/ as member": (OPEN, "BY DESIGN: crew members propose crew names"),
    "POST /api/crews/{id}/approve-name/ as member": (OPEN, "BY DESIGN: crew members approve a proposed crew name"),
    "POST /api/campaigns/{id}/increment-wanted/ as member": (OPEN, "BY DESIGN (U4): any member may bump the wanted level"),
    "POST /api/characters/{id}/assist-help/ as member": (OPEN, "BY DESIGN: a crewmate assists with their own PC and pays the stress (test_assist_help_pending)"),
    **_both("PUT", "/api/user-profiles/update/", OPEN, "BY DESIGN: updates the caller's own profile"),
    **_both("POST", "/api/user-profiles/change-password/", INVALID, "BY DESIGN: changes the caller's own password; 400 for a wrong current password"),

}


def write_endpoints():
    """(method, url template, route prefix) for every write the router serves."""
    out = []
    for prefix, viewset, _basename in router.registry:
        allowed = {m.upper() for m in viewset.http_method_names}
        if hasattr(viewset, "create") and "POST" in allowed:
            out.append(("POST", f"/api/{prefix}/", prefix))
        for verb, attr in (("PUT", "update"), ("PATCH", "partial_update"), ("DELETE", "destroy")):
            if hasattr(viewset, attr) and verb in allowed:
                out.append((verb, f"/api/{prefix}/{{id}}/", prefix))
        for extra in viewset.get_extra_actions():
            path = re.sub(r"\(\?P<(\w+)>[^)]*\)", r"{\1}", extra.url_path)
            base = f"/api/{prefix}/{{id}}/" if extra.detail else f"/api/{prefix}/"
            for method in extra.mapping:
                if method.upper() not in READ_METHODS:
                    out.append((method.upper(), f"{base}{path}/", prefix))
    return out


class PermissionMatrixTests(TestCase):
    def setUp(self):
        self.gm = User.objects.create_user(username="pm_gm", password="pw-pm-gm-1")
        self.owner = User.objects.create_user(username="pm_owner", password="pw-pm-owner-1")
        self.member = User.objects.create_user(username="pm_member", password="pw-pm-member-1")
        self.stranger = User.objects.create_user(username="pm_stranger", password="pw-pm-stranger-1")
        self.invitee = User.objects.create_user(username="pm_invitee", password="pw-pm-invitee-1")
        self.staff = User.objects.create_user(username="pm_staff", password="pw-pm-staff-1", is_staff=True)
        for u in (self.gm, self.owner, self.member, self.stranger, self.invitee, self.staff):
            UserProfile.objects.get_or_create(user=u)

        self.campaign = Campaign.objects.create(name="PM Camp", gm=self.gm)
        self.campaign.players.add(self.owner, self.member)
        # A live name proposal, so approve-name runs its member check.
        self.crew = Crew.objects.create(
            name="PM Crew", campaign=self.campaign,
            proposed_name="PM Proposed", proposed_by=self.owner,
        )
        self.heritage, _ = Heritage.objects.get_or_create(
            name="Human", defaults={"base_hp": 0, "description": ""}
        )
        self.pc = Character.objects.create(
            user=self.owner, campaign=self.campaign, crew=self.crew,
            true_name="PM Owner PC", heritage=self.heritage,
        )
        self.member_pc = Character.objects.create(
            user=self.member, campaign=self.campaign, crew=self.crew,
            true_name="PM Member PC", heritage=self.heritage,
        )
        self.session = Session.objects.create(campaign=self.campaign, name="PM S1", status="ACTIVE")
        self.campaign.active_session = self.session
        self.campaign.save()
        self.roll = Roll.objects.create(character=self.pc, session=self.session)
        self.group_action = GroupAction.objects.create(session=self.session, leader=self.pc)
        self.faction = Faction.objects.create(name="PM Faction", campaign=self.campaign)
        self.npc = NPC.objects.create(
            name="PM NPC", creator=self.gm, campaign=self.campaign, visible_to_players=True
        )
        self.clock = ProgressClock.objects.create(
            name="PM Clock", clock_type="DANGER", max_segments=4, campaign=self.campaign,
            character=self.pc, created_by=self.owner,
        )
        self.item = EquipmentItem.objects.create(
            name="PM Item", scope="CAMPAIGN", campaign=self.campaign, created_by=self.gm
        )
        self.tracker = ExperienceTracker.objects.create(character=self.pc, session=self.session)
        self.history = CharacterHistory.objects.create(
            character=self.pc, editor=self.owner, changed_fields={"rival": {"old": "", "new": "x"}}
        )
        self.crew_history = CrewHistory.objects.create(
            crew=self.crew, changed_fields={"name": {"old": "", "new": "PM Crew"}}
        )
        self.invitation = CampaignInvitation.objects.create(
            campaign=self.campaign, invited_user=self.invitee, invited_by=self.gm
        )
        self.showcased = ShowcasedNPC.objects.create(campaign=self.campaign, npc=self.npc)
        self.xp_history = XPHistory.objects.create(character=self.pc, amount=1)
        self.plan_item = AdvancementPlanItem.objects.create(character=self.pc, track="insight")

    # Targets and bodies

    def target_id(self, prefix):
        """The victim's object for a detail URL, or None to skip the route."""
        from characters import models as m

        explicit = {
            "user-profiles": UserProfile.objects.filter(user=self.owner).values_list("pk", flat=True).first(),
            "characters": self.pc.pk,
            "character-history": self.history.pk,
            "crew-history": self.crew_history.pk,
            "experience-tracker": self.tracker.pk,
            "sessions": self.session.pk,
            "rolls": self.roll.pk,
            "group-actions": self.group_action.pk,
            "campaigns": self.campaign.pk,
            "campaign-invitations": self.invitation.pk,
            "showcased-npcs": self.showcased.pk,
            "progress-clocks": self.clock.pk,
            "factions": self.faction.pk,
            "equipment-items": self.item.pk,
            "npcs": self.npc.pk,
            "crews": self.crew.pk,
            "xp-history": self.xp_history.pk,
            "heritages": self.heritage.pk,
        }
        if prefix in explicit:
            return explicit[prefix]
        # Catalogs and the rest: any existing row, made if needed.
        viewset = next(v for p, v, _ in router.registry if p == prefix)
        model = viewset.queryset.model
        row = model.objects.first()
        if row is None:
            row = self._make_row(model)
        return row.pk if row is not None else None

    def _make_row(self, model):
        from django.db import models as dj

        kwargs = {}
        for f in model._meta.concrete_fields:
            if f.primary_key or f.has_default() or f.null:
                continue
            if f.is_relation:
                rel = {Character: self.pc, Campaign: self.campaign, User: self.gm,
                       Session: self.session, Crew: self.crew}.get(f.related_model)
                if rel is None:
                    return None
                kwargs[f.name] = rel
            elif f.empty_strings_allowed:
                kwargs[f.name] = f"{model.__name__} row"[: getattr(f, "max_length", None) or 50]
            elif isinstance(f, dj.BooleanField):
                kwargs[f.name] = False
            elif isinstance(f, (dj.IntegerField, dj.FloatField, dj.DecimalField)):
                kwargs[f.name] = 1
            else:
                return None
        return model.objects.create(**kwargs)

    def body_for(self, method, template):
        """A body aimed at the victim's campaign, so a 2xx means a real write."""
        c, pc, s = self.campaign.pk, self.pc.pk, self.session.pk
        bodies = {
            "/api/characters/": {"true_name": "Intruder", "campaign": c, "heritage": self.heritage.pk},
            "/api/sessions/": {"campaign": c, "name": "Intruder session"},
            "/api/npcs/": {"name": "Intruder NPC", "campaign": c},
            "/api/progress-clocks/": {
                "name": "Intruder clock", "clock_type": "DANGER", "max_segments": 4,
                "campaign": c, "character": pc,
            },
            "/api/equipment-items/": {"name": "Intruder item", "scope": "TEMPLATE"},
            "/api/crews/": {"name": "Intruder crew", "campaign": c},
            "/api/factions/": {"name": "Intruder faction", "campaign": c},
            "/api/campaigns/": {"name": "My own campaign"},
            "/api/rolls/": {"character": pc, "session": s, "roll_type": "ACTION"},
            "/api/group-actions/": {"session": s, "leader": pc, "action_name": "hunt", "goal_label": "x"},
            "/api/experience-tracker/award/": {"character": pc, "session": s, "trigger": "BELIEFS"},
            "/api/experience-tracker/revoke/": {"character": pc, "session": s, "trigger": "BELIEFS"},
            "/api/campaigns/{id}/assign-character/": {"character_id": pc},
            "/api/campaigns/{id}/unassign-character/": {"character_id": pc},
            "/api/crews/{id}/propose-name/": {"name": "Intruder crew name"},
            "/api/equipment-items/{id}/set-campaign-access/": {"campaign": c, "enabled": True},
            "/api/equipment-items/from-kit-item/": {"campaign": c, "name": "Intruder kit item"},
            "/api/characters/{id}/assist-help/": {"helper_character_id": self.member_pc.pk, "session_id": s},
        }
        return bodies.get(template, {})

    # The walk

    # Actors

    _fresh = 0

    def fresh_actor(self, kind):
        """A new user for one request. Called inside that request's savepoint."""
        PermissionMatrixTests._fresh += 1
        n = PermissionMatrixTests._fresh
        user = User.objects.create_user(username=f"pm_{kind}_{n}", password=f"pw-pm-{kind}-{n}")
        UserProfile.objects.get_or_create(user=user)
        if kind == "member":
            self.campaign.players.add(user)
            self.actor_pc = Character.objects.create(
                user=user, campaign=self.campaign, crew=self.crew,
                true_name=f"PM Member PC {n}", heritage=self.heritage,
            )
        else:
            self.actor_pc = None
        return user

    # Who should be allowed, per route prefix (default: the campaign GM).
    ALLOWED_ACTOR = {
        "user-profiles": "owner",
        "campaign-invitations": "invitee",
        "heritages": "staff", "vices": "staff", "abilities": "staff",
        "hamon-abilities": "staff", "spin-abilities": "staff",
        "claims": "staff", "crew-playbooks": "staff",
        "crew-special-abilities": "staff", "crew-upgrades": "staff",
    }

    # Per-route overrides of ALLOWED_ACTOR.
    ROUTE_ALLOWED_ACTOR = {
        # A player assigns or unassigns their own PC.
        "POST /api/campaigns/{id}/assign-character/": "owner",
        "POST /api/campaigns/{id}/unassign-character/": "owner",
    }

    # Positive controls known to 5xx today. The fix PR deletes its entry; a
    # stale entry fails like EXPECTED.
    KNOWN_CONTROL_ERRORS = {
        "POST /api/user-profiles/": "KNOWN BUG, D: a second profile hits the unique constraint (500)",
    }

    # Routes where no actor can reach a 2xx/4xx other than 404/405, with why.
    NO_POSITIVE_CONTROL = {}

    def allowed_user(self, prefix, key=""):
        who = self.ROUTE_ALLOWED_ACTOR.get(key) or self.ALLOWED_ACTOR.get(prefix, "gm")
        return {"owner": self.owner, "invitee": self.invitee, "staff": self.staff, "gm": self.gm}[who]

    def send(self, user, method, url, body):
        client = APIClient()
        client.raise_request_exception = False
        client.force_authenticate(user)
        return client.generic(method, url, data=json.dumps(body), content_type="application/json")

    # The walk

    def observe(self):
        privileged = APIClient()
        results = {}
        self.skipped = []
        self.control_failures = []
        self.control_errors = set()
        for method, template, prefix in write_endpoints():
            needs_id = "{id}" in template
            obj_id = self.target_id(prefix) if needs_id else None
            if needs_id and obj_id is None:
                self.skipped.append(f"{method} {template}")
                continue
            url = template.replace("{id}", str(obj_id)).replace("{item_id}", str(self.plan_item.pk))
            body = self.body_for(method, template)
            if method == "PUT":
                # A full body, so a refusal can't hide behind a validation 400.
                privileged.force_authenticate(self.gm if prefix != "user-profiles" else self.owner)
                current = privileged.get(url)
                if current.status_code == 200 and isinstance(current.data, dict):
                    body = json.loads(json.dumps(current.data, default=str))
            for actor in ACTORS:
                with transaction.atomic():
                    user = self.fresh_actor(actor)
                    actor_body = dict(body) if isinstance(body, dict) else body
                    if template == "/api/characters/{id}/assist-help/" and self.actor_pc:
                        # The member helps with their own PC, the by-design path.
                        actor_body["helper_character_id"] = self.actor_pc.pk
                    response = self.send(user, method, url, actor_body)
                    transaction.set_rollback(True)
                text = response.content.decode("utf-8", "replace")
                results[f"{method} {template} as {actor}"] = (
                    classify(response.status_code, text), response.status_code
                )
            key = f"{method} {template}"
            if key not in self.NO_POSITIVE_CONTROL:
                with transaction.atomic():
                    control = self.send(self.allowed_user(prefix, key), method, url, body)
                    transaction.set_rollback(True)
                who = self.allowed_user(prefix, key).username
                if control.status_code in (404, 405):
                    self.control_failures.append(
                        f"{key}: positive control ({who}) got "
                        f"{control.status_code}; the URL or target is wrong, or add it to NO_POSITIVE_CONTROL"
                    )
                elif control.status_code >= 500:
                    self.control_errors.add(key)
                    if key not in self.KNOWN_CONTROL_ERRORS:
                        self.control_failures.append(
                            f"{key}: positive control ({who}) got {control.status_code} (server error)"
                        )
        return results

    def test_every_write_is_closed_unless_listed(self):
        results = self.observe()
        if os.environ.get("PERM_MATRIX_DUMP"):
            for key, (cls, code) in sorted(results.items()):
                marker = "" if cls == CLOSED else "   <=="
                print(f"{code}  {cls:8} {key}{marker}")
        # A route with no target object would never be tested; fail instead.
        problems = [f"{route}: no object to target (add it to target_id)" for route in self.skipped]
        problems += self.control_failures
        for key in sorted(set(self.KNOWN_CONTROL_ERRORS) - self.control_errors):
            problems.append(f"{key}: listed in KNOWN_CONTROL_ERRORS but its positive control no longer errors")
        for key, (cls, code) in sorted(results.items()):
            expected_cls = EXPECTED.get(key, (CLOSED, ""))[0]
            if cls != expected_cls:
                problems.append(f"{key}: got {cls} ({code}), expected {expected_cls}")
        for key in sorted(set(EXPECTED) - set(results)):
            problems.append(f"{key}: listed in EXPECTED but the route no longer exists")
        self.assertEqual(problems, [], "\n" + "\n".join(problems))

    def test_member_crew_stat_patch(self):
        """KNOWN HOLE, S5: a crew member can PATCH crew stats.

        The user decided (2026-10-26) that level, xp, coin, rep, hold, turf and
        wanted_level are GM only. Today a member's PATCH of coin goes through.
        S5 flips this test to expect 403 and the coin unchanged.
        """
        with transaction.atomic():
            member = self.fresh_actor("member")
            response = self.send(member, "PATCH", f"/api/crews/{self.crew.pk}/", {"coin": 3})
            self.crew.refresh_from_db()
            coin_after = self.crew.coin
            transaction.set_rollback(True)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(coin_after, 3)
