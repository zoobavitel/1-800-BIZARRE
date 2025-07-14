import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from characters.models import Campaign, Character

try:
    campaign = Campaign.objects.get(name='New York State of Mind')
    characters = Character.objects.filter(campaign=campaign)
    
    if characters.exists():
        print(f'Player Characters in {campaign.name}:')
        for character in characters:
            print(f'- {character.true_name} (User: {character.user.username if character.user else 'N/A'})')
    else:
        print(f'No player characters found in {campaign.name}.')
except Campaign.DoesNotExist:
    print('Campaign \'New York State of Mind\' not found.')

