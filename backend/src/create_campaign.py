from django.contrib.auth.models import User
from characters.models import Campaign

# Get the GM user
zoob = User.objects.get(username="zoob")

# Create the campaign
campaign, created = Campaign.objects.get_or_create(name="A History of Bad Men", defaults={"gm": zoob, "description": "A JoJo adventure."})
if not created:
    campaign.gm = zoob
    campaign.save()
    print("Campaign already existed, GM reassigned to zoob.")
else:
    print("Campaign created with zoob as GM.")

print(f"Campaign ID: {campaign.id}") 