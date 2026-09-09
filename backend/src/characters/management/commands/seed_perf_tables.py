"""
Seed campaigns/sessions/characters/tokens for Saturday-table load tests.

Tiers (match scripts/perf/saturday-table.mjs):
  floor   — 1 table × 5 players
  target  — 2 tables × 5 players  (staging gate)
  stretch — 3 tables × 6 players

Writes JSON consumed by perf harnesses (tokens never logged at INFO).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from rest_framework.authtoken.models import Token

from characters.models import Campaign, Character, Crew, Heritage, Session

TIERS = {
    "floor": {"tables": 1, "players": 5},
    "target": {"tables": 2, "players": 5},
    "stretch": {"tables": 3, "players": 6},
}

PERF_PASSWORD = "PerfLoadTest1!"
ACTION_DOTS = {
    "hunt": 1,
    "study": 0,
    "survey": 0,
    "tinker": 0,
    "finesse": 0,
    "prowl": 0,
    "skirmish": 0,
    "wreck": 0,
    "bizarre": 0,
    "command": 0,
    "consort": 0,
    "sway": 0,
}


class Command(BaseCommand):
    help = "Seed perf load-test tables (floor/target/stretch) and write JSON for harnesses."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tier",
            choices=sorted(TIERS.keys()),
            default="target",
            help="Concurrent table layout (default: target = 2×5).",
        )
        parser.add_argument(
            "--output",
            type=str,
            default="",
            help="JSON output path (default: /tmp/bizarre-perf-seed-<tier>.json).",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete previously seeded perf_* users/campaigns before creating.",
        )

    def handle(self, *args, **options):
        settings_mod = os.environ.get("DJANGO_SETTINGS_MODULE", "")
        if settings_mod.endswith("settings_prod"):
            raise CommandError(
                "Refusing to seed under settings_prod. "
                "Use app.settings (sqlite) or a dedicated staging settings module."
            )
        tier = options["tier"]
        spec = TIERS[tier]
        out = options["output"] or f"/tmp/bizarre-perf-seed-{tier}.json"

        if options["reset"]:
            self._reset_perf_data()

        heritage, _ = Heritage.objects.get_or_create(
            name="Perf Human",
            defaults={"base_hp": 0, "description": "perf seed heritage"},
        )

        tables = []
        for t in range(1, spec["tables"] + 1):
            tables.append(self._seed_table(t, spec["players"], heritage, tier))

        payload = {
            "tier": tier,
            "tables": tables,
            "password": PERF_PASSWORD,
            "notes": (
                "For local/staging load tests only. Do not point harnesses at production."
            ),
        }
        path = Path(out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded tier={tier} tables={spec['tables']} "
                f"players_each={spec['players']} → {path}"
            )
        )

    def _reset_perf_data(self):
        Campaign.objects.filter(name__startswith="Perf Table ").delete()
        User.objects.filter(username__startswith="perf_").delete()
        self.stdout.write("Reset existing perf_* users and Perf Table campaigns.")

    def _seed_table(self, table_num: int, players: int, heritage: Heritage, tier: str):
        gm_name = f"perf_gm_t{table_num}_{tier}"
        gm, created = User.objects.get_or_create(
            username=gm_name,
            defaults={"email": f"{gm_name}@example.com"},
        )
        if created:
            gm.set_password(PERF_PASSWORD)
            gm.save()
        else:
            gm.set_password(PERF_PASSWORD)
            gm.save(update_fields=["password"])

        campaign_name = f"Perf Table {table_num} ({tier})"
        campaign, _ = Campaign.objects.get_or_create(
            name=campaign_name,
            defaults={"gm": gm, "description": "perf load-test campaign"},
        )
        if campaign.gm_id != gm.id:
            campaign.gm = gm
            campaign.save(update_fields=["gm"])

        crew, _ = Crew.objects.get_or_create(
            name=f"Perf Crew {table_num} ({tier})",
            defaults={"campaign": campaign},
        )
        if crew.campaign_id != campaign.id:
            crew.campaign = campaign
            crew.save(update_fields=["campaign"])

        session, _ = Session.objects.get_or_create(
            campaign=campaign,
            name=f"Perf Session {table_num}",
            defaults={
                "status": "ACTIVE",
                "default_position": "risky",
                "default_effect": "standard",
            },
        )
        if campaign.active_session_id != session.id:
            campaign.active_session = session
            campaign.save(update_fields=["active_session"])

        gm_token, _ = Token.objects.get_or_create(user=gm)
        player_rows = []
        for p in range(1, players + 1):
            uname = f"perf_p{p}_t{table_num}_{tier}"
            user, created = User.objects.get_or_create(
                username=uname,
                defaults={"email": f"{uname}@example.com"},
            )
            user.set_password(PERF_PASSWORD)
            user.save()
            campaign.players.add(user)
            token, _ = Token.objects.get_or_create(user=user)
            char, _ = Character.objects.get_or_create(
                user=user,
                campaign=campaign,
                true_name=f"Perf PC {p} T{table_num}",
                defaults={
                    "crew": crew,
                    "heritage": heritage,
                    "action_dots": ACTION_DOTS,
                    "stress": 3,
                },
            )
            if char.crew_id != crew.id or char.heritage_id != heritage.id:
                char.crew = crew
                char.heritage = heritage
                char.action_dots = ACTION_DOTS
                char.save()
            session.characters_involved.add(char)
            player_rows.append(
                {
                    "username": uname,
                    "token": token.key,
                    "character_id": char.id,
                }
            )

        return {
            "campaign_id": campaign.id,
            "session_id": session.id,
            "crew_id": crew.id,
            "gm": {"username": gm_name, "token": gm_token.key},
            "players": player_rows,
        }
