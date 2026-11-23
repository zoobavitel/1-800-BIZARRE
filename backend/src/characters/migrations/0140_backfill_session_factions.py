from django.db import migrations


def backfill_session_factions(apps, schema_editor):
    """Keep existing rosters: each session gets the factions of its NPCs."""
    Session = apps.get_model("characters", "Session")
    Involvement = apps.get_model("characters", "SessionNPCInvolvement")
    rows = (
        Involvement.objects.filter(npc__faction__isnull=False)
        .values_list("session_id", "npc__faction_id", "session__campaign_id", "npc__faction__campaign_id")
        .distinct()
    )
    through = Session.factions_involved.through
    links = [
        through(session_id=session_id, faction_id=faction_id)
        for session_id, faction_id, campaign_id, faction_campaign_id in rows
        if campaign_id == faction_campaign_id
    ]
    through.objects.bulk_create(links, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("characters", "0139_npc_hidden_by_default"),
    ]

    operations = [
        migrations.RunPython(backfill_session_factions, migrations.RunPython.noop),
    ]
