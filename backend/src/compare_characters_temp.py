
import json
from characters.models import Character, NPC

try:
    jack_rice = Character.objects.get(true_name='Jack Rice')
    mf_doom = NPC.objects.get(name='MF DOOM')

    jack_rice_data = {
        'name': jack_rice.true_name,
        'type': 'Player Character',
        'heritage': jack_rice.heritage.name,
        'vice': jack_rice.vice.name,
        'action_dots': jack_rice.action_dots,
        'xp_clocks': jack_rice.xp_clocks,
        'coin_stats': jack_rice.coin_stats,
        'stress': jack_rice.stress,
        'trauma': jack_rice.trauma,
        'armor_type': jack_rice.armor_type,
        'custom_ability_description': jack_rice.custom_ability_description,
        'extra_custom_abilities': jack_rice.extra_custom_abilities,
        'standard_abilities': [sa.name for sa in jack_rice.standard_abilities.all()],
        'stand_name': jack_rice.stand.name if hasattr(jack_rice, 'stand') else 'N/A',
    }

    mf_doom_data = {
        'name': mf_doom.name,
        'type': 'Non-Player Character',
        'level': mf_doom.level,
        'heritage': mf_doom.heritage.name if mf_doom.heritage else 'N/A',
        'playbook': mf_doom.playbook,
        'stand_coin_stats': mf_doom.stand_coin_stats,
        'harm_clock_current': mf_doom.harm_clock_current,
        'vulnerability_clock_current': mf_doom.vulnerability_clock_current,
        'armor_charges': mf_doom.armor_charges,
        'custom_abilities': mf_doom.custom_abilities,
        'description': mf_doom.description,
        'role': mf_doom.role,
        'weakness': mf_doom.weakness,
        'need': mf_doom.need,
        'desire': mf_doom.desire,
        'rumour': mf_doom.rumour,
        'secret': mf_doom.secret,
        'passion': mf_doom.passion,
        'purveyor': mf_doom.purveyor,
        'notes': mf_doom.notes,
        'items': mf_doom.items,
        'contacts': mf_doom.contacts,
        'faction_status': mf_doom.faction_status,
        'inventory': mf_doom.inventory,
    }

    print(json.dumps({'jack_rice': jack_rice_data, 'mf_doom': mf_doom_data}, indent=2))

except Character.DoesNotExist:
    print("Error: Jack Rice character not found.")
except NPC.DoesNotExist:
    print("Error: MF DOOM NPC not found. Please create it first.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
