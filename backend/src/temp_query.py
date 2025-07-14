import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from characters.models import Campaign, Character
from django.contrib.auth.models import User

try:
    campaign = Campaign.objects.get(name='New York State of Mind')
    print('Campaign: ' + campaign.name)
    gm_username = campaign.gm.username if campaign.gm else 'N/A'
    print('GM: ' + gm_username)
    print('Players:')
    for player in campaign.players.all():
        print('- ' + player.username)
    print('Characters:')
    for character in campaign.characters.all():
        print('- ' + character.true_name + ' (Player: ' + (character.user.username if character.user else 'N/A') + ')')
except Campaign.DoesNotExist:
    print('Campaign \'New York State of Mind\' not found.')
