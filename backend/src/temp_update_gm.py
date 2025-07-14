import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from characters.models import Campaign
from django.contrib.auth.models import User

try:
    campaign = Campaign.objects.get(name='New York State of Mind')
    zoob_user = User.objects.get(username='zoob')
    campaign.gm = zoob_user
    campaign.save()
    print(f'GM for \'{campaign.name}\' updated to {campaign.gm.username}.')
except Campaign.DoesNotExist:
    print('Campaign \'New York State of Mind\' not found.')
except User.DoesNotExist:
    print('User \'zoob\' not found.')
