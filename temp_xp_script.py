from characters.models import Campaign, Character, ExperienceTracker

try:
    campaign = Campaign.objects.get(name="A History of Bad Men")
    print(f"Found campaign: {campaign.name}")
    characters = Character.objects.filter(campaign=campaign)

    if not characters.exists():
        print("No player characters found in this campaign.")
    else:
        for character in characters:
            print(f"\n--- XP History for {character.true_name} ({character.alias if character.alias else 'N/A'}) ---")
            xp_entries = ExperienceTracker.objects.filter(character=character).order_by('session_date')
            if not xp_entries.exists():
                print("No XP entries found for this character.")
            else:
                for entry in xp_entries:
                    print(f"  Date: {entry.session_date.strftime('%Y-%m-%d %H:%M')}")
                    print(f"  Trigger: {entry.get_trigger_display()}")
                    print(f"  Description: {entry.description}")
                    print(f"  XP Gained: {entry.xp_gained}")
                    print("-" * 30)
except Campaign.DoesNotExist:
    print("Campaign 'A History of Bad Men' not found.")
except Exception as e:
    print(f"An error occurred: {e}")
