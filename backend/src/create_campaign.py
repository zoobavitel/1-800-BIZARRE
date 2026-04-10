from django.contrib.auth.models import User
from characters.models import Campaign

# Get the GM user (replace 'test_gm' with the actual GM username for your deployment)
gm = User.objects.get(username="test_gm")

# Create the campaign
campaign, created = Campaign.objects.get_or_create(
    name="A History of Bad Men", defaults={"gm": gm, "description": "A JoJo adventure."}
)
if not created:
    campaign.gm = gm
    campaign.save()
    print("Campaign already existed, GM reassigned.")
else:
    print("Campaign created.")

print(f"Campaign ID: {campaign.id}")
