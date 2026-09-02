"""
Sync standard ability catalog to docs/1-(800)-BIZARRE SRD_DEV.md.
Remove retired catalog entries and refresh descriptions/categories.
"""

from django.db import migrations

_REMOVED_DISPLAY_NAMES = (
    "Spin-Boosted Blow",
    "Steady Barrage",
    "Battleborn",
    "Swan Song",
    "Fortitude",
    "Rule of Cool",
)

_REMOVED_NAMES = frozenset(n.lower() for n in _REMOVED_DISPLAY_NAMES)

_NAME_ALIASES = {
    "like looking into a mirror": "Like looking into a Mirror",
}

_SRD_STANDARD_ABILITIES = [
    {"name": "Ambush", "category": "aggression", "description": "When you attack from hiding or spring a trap, you get +1d."},
    {"name": "Cascade Effect", "category": "aggression", "description": "If you roll a 6 from your resistance roll to resist a physical or bizarre consequence, the attacker suffers a mirrored backlash."},
    {"name": "Final Barrage", "category": "aggression", "description": "When you take Level 4 harm, use your stand armor to make an attack with +1 effect before going down."},
    {"name": "Phantom Pain", "category": "aggression", "description": "Spend 1 stress to make your stand attack through cover, walls, or barriers that would otherwise block it. Works within your stand range."},
    {"name": "Savage", "category": "aggression", "description": "When you unleash physical violence, it's especially frightening. When you command a frightened target, take +1d."},
    {"name": "Invigorated", "category": "endurance", "description": "you recover from harm faster. Permanently fill in one of your healing clock segments. Take +1d to healing treatment rolls."},
    {"name": "Iron Will", "category": "endurance", "description": "You're immune to the terror that some bizarre entities inflict on sight. Take +1d to resistance rolls with Resolve."},
    {"name": "Tough as Nails", "category": "endurance", "description": "Penalties from harm are one level less severe (though level 4 harm is still fatal)"},
    {"name": "Overdrive", "category": "endurance", "description": "While wearing non-Stand armor, gain an extra +1 armor."},
    {"name": "Masochist", "category": "endurance", "description": "When your Stand takes harm, reduce the user's damage by 1 level. If the Stand hits Level 4 harm with no way to reduce, both die."},
    {"name": "Undying Will", "category": "endurance", "description": "When taking Level 3 harm, you can act normally for one round. Afterwards, actions cost 2 stress."},
    {"name": "Bizarre Step", "category": "cunning", "description": "Push (2 stress) to instantly reposition within your stand's range. Nearby observers must resist or lose track of you."},
    {"name": "Cloak & Dagger", "category": "cunning", "description": "When you use a disguise or other form of covert misdirection, you get +1d to rolls to confuse or deflect suspicion. When you throw off your disguise, the resulting surprise gives you the initiative in the situation."},
    {"name": "Mesmeriser", "category": "cunning", "description": "When you Sway someone, you may cause them to forget that it's happened until they next interact with you."},
    {"name": "Saboteur", "category": "cunning", "description": "When you wreck, the work is much quieter than it should be and the damage is hidden from casual inspection."},
    {"name": "Shadow", "category": "cunning", "description": "Expend your stand/spin/hamon armor to resist a consequence from detection, surveillance, or security measures, or to push yourself for a feat of athletics or stealth."},
    {"name": "Subterfuge", "category": "cunning", "description": "You may expend your stand armor/spin/hamon armor to resist a consequence from suspicion or persuasion, or to push yourself for subterfuge."},
    {"name": "Mule", "category": "cunning", "description": "Your load limits are higher than normal: Light: 5 (instead of 1-3) Normal: 7 (instead of 4-5) Heavy: 8 (instead of 6)"},
    {"name": "Rigging", "category": "cunning", "description": "You get 2 free load in two of the equipment categories: Weapons Implements Supplies Gear Documents Tools"},
    {"name": "Bizarre Intuition", "category": "awareness", "description": "You have a bizarre sense for danger. You cannot be surprised."},
    {"name": "Focused", "category": "awareness", "description": "You may expend your stand armor/spin/hamon to resist a consequence of surprise or mental harm (fear, confusion, losing track of someone)."},
    {"name": "Like looking into a Mirror", "category": "awareness", "description": "You can always tell when someone is lying."},
    {"name": "Mastermind", "category": "awareness", "description": "You're always aware of supernatural entities in your presence. Take +1d when you gather info about the bizarre."},
    {"name": "Scout", "category": "awareness", "description": "When you gather info to locate a target, you get +1 effect. When you hide in a prepared position or use camouflage, you get +1d to roll to avoid detection."},
    {"name": "Shared Vision", "category": "awareness", "description": "You can see through your Stand's eyes, even at extreme distances."},
    {"name": "Aura of Confidence", "category": "presence", "description": "Your presence inspires trust and courage. Allies within close range of you gain +1d to resistance rolls against fear or intimidation."},
    {"name": "Scoundrel", "category": "presence", "description": "You gain +1d to Consort when you gather information on a target for a score. You get +1d to the engagement roll for that operation."},
    {"name": "Trust in Me", "category": "presence", "description": "You get +1d vs. a target with whom you have an intimate relationship."},
    {"name": "Foresight", "category": "teamwork", "description": "Twice per score, you can assist a teammate without paying stress. Tell us how you prepared for this."},
    {"name": "Bodyguard", "category": "teamwork", "description": "When you protect a teammate, take +1d to your resistance roll. When you gather info to anticipate possible threats in the current situation, you get +1 effect."},
    {"name": "Functioning Vice", "category": "teamwork", "description": "When you indulge your vice, you may adjust the dice outcome by 1 or 2 (up or down). An ally who joins in your vice may do the same."},
    {"name": "Stand Proud", "category": "teamwork", "description": "When you Command an ally in combat, they continue to fight when they would otherwise break (they're not taken out when they suffer level 3 harm). They gain +1 effect and 1 armor."},
    {"name": "Analyst", "category": "teamwork", "description": "During downtime, you get two ticks to distribute among any long-term project clocks that involve investigation or learning a new formula or design plan."},
    {"name": "Expertise", "category": "teamwork", "description": "Choose one of your action ratings. When you lead a group action using that action, you can suffer only 1 stress at most, regardless of the number of failed rolls."},
    {"name": "Calculating", "category": "teamwork", "description": "Due to your careful planning, during downtime, you may give yourself or another crew member +1 downtime action."},
    {"name": "The Devil's Footsteps", "category": "adaptability", "description": "When you push yourself, choose one of the following additional benefits: Perform a feat of athletics that verges past superhuman for 1 scene. Maneuver to confuse your enemies so they mistakenly attack each other."},
    {"name": "Superhero Landing", "category": "adaptability", "description": "Expend Stand armor/spin/hamon to reduce fall/collision harm by 1. Gain +1d for stylish aerial actions."},
    {"name": "Daredevil", "category": "adaptability", "description": "When you roll a desperate action, you get +1d to your roll if you also take -1d to any resistance roll(s) against consequences from your action(s)."},
    {"name": "Bizarre Improvisation", "category": "adaptability", "description": "Take 2 stress to roll your best action rating while performing a different action. Say how you adapt your action to this use."},
    {"name": "Weapon Recall", "category": "stand_nature", "description": "Your Stand returns to your hand instantly when thrown or disarmed."},
    {"name": "Stand Evolution", "category": "stand_nature", "description": "Spend 5 stress mid-score to unlock a temporary new unique ability."},
    {"name": "Channel Force", "category": "stand_nature", "description": "Redirect a supernatural force through your Stand's form or medium."},
    {"name": "Requiem", "category": "stand_nature", "description": "Spend 5 stress to elevate your stand beyond its normal limits temporarily. For one scene, treat all your stand coin stats as one grade higher."},
    {"name": "Guardian Angel", "category": "stand_nature", "description": "Your Stand can manufacture armor for others. Take 2 stress to give an ally within Range one Stand Armor charge. They hold it and may check it themselves to reduce a consequence by 1 level. Unspent charges vanish at the end of the scene. You cannot give a given ally more than one charge per scene."},
]

def _norm_name(value):
    return str(value or "").strip().lower()


def _filtered_json_list(lst):
    out = []
    changed = False
    for entry in lst:
        if isinstance(entry, dict) and _norm_name(entry.get("name")) in _REMOVED_NAMES:
            changed = True
            continue
        out.append(entry)
    return out, changed


def _find_standard_ability(Ability, row):
    norm = _norm_name(row["name"])
    ability = Ability.objects.filter(name__iexact=row["name"]).first()
    if ability is not None:
        return ability
    if norm == _norm_name(_NAME_ALIASES["like looking into a mirror"]):
        ability = Ability.objects.filter(name__iexact="Like Looking into a Mirror").first()
        if ability is not None:
            return ability
    return Ability.objects.filter(type="standard", name__iexact=row["name"]).first()


def sync_standard_abilities_srd_dev(apps, schema_editor):
    Ability = apps.get_model("characters", "Ability")
    Character = apps.get_model("characters", "Character")
    NPC = apps.get_model("characters", "NPC")
    Stand = apps.get_model("characters", "Stand")

    for row in _SRD_STANDARD_ABILITIES:
        ability = _find_standard_ability(Ability, row)
        if ability is None:
            Ability.objects.create(
                name=row["name"],
                type="standard",
                category=row["category"],
                description=row["description"],
            )
            continue
        updates = []
        if ability.name != row["name"]:
            ability.name = row["name"]
            updates.append("name")
        if ability.category != row["category"]:
            ability.category = row["category"]
            updates.append("category")
        if ability.description != row["description"]:
            ability.description = row["description"]
            updates.append("description")
        if ability.type != "standard":
            ability.type = "standard"
            updates.append("type")
        if updates:
            ability.save(update_fields=updates)

    for character in Character.objects.all().iterator():
        update_fields = []
        extra = getattr(character, "extra_custom_abilities", None)
        if isinstance(extra, list) and extra:
            filtered_extra, changed_x = _filtered_json_list(extra)
            if changed_x:
                character.extra_custom_abilities = filtered_extra
                update_fields.append("extra_custom_abilities")

        temp = getattr(character, "development_temporary_ability", None)
        if isinstance(temp, dict) and _norm_name(temp.get("name")) in _REMOVED_NAMES:
            character.development_temporary_ability = None
            update_fields.append("development_temporary_ability")

        if update_fields:
            character.save(update_fields=update_fields)

    for npc in NPC.objects.all().iterator():
        raw = getattr(npc, "abilities", None)
        if isinstance(raw, list) and raw:
            filtered, changed = _filtered_json_list(raw)
            if changed:
                npc.abilities = filtered
                npc.save(update_fields=["abilities"])

    removed_objs = list(Ability.objects.filter(name__in=_REMOVED_DISPLAY_NAMES))
    removed_pks = [a.pk for a in removed_objs]
    if removed_pks:
        Stand.objects.filter(standard_ability_id__in=removed_pks).update(
            standard_ability_id=None
        )
        for ab in removed_objs:
            linked = Character.objects.filter(standard_abilities__pk=ab.pk)
            for ch in linked.distinct():
                ch.standard_abilities.remove(ab)
        Ability.objects.filter(pk__in=removed_pks).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("characters", "0098_sync_spin_hamon_abilities_srd"),
    ]

    operations = [
        migrations.RunPython(sync_standard_abilities_srd_dev, migrations.RunPython.noop),
    ]
