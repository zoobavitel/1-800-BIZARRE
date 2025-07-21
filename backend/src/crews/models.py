from django.db import models
from django.contrib.auth.models import User


class Claim(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return self.name

class CrewSpecialAbility(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return self.name

class CrewPlaybook(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    claims = models.ManyToManyField(Claim, related_name='playbooks')
    special_abilities = models.ManyToManyField(CrewSpecialAbility, related_name='playbooks')

    def __str__(self):
        return self.name

class CrewUpgrade(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    total_boxes = models.IntegerField(default=1)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.total_boxes} boxes)"

class Crew(models.Model):
    name = models.CharField(max_length=100)
    campaign = models.ForeignKey('campaigns.Campaign', on_delete=models.CASCADE, related_name='crews')
    playbook = models.ForeignKey(CrewPlaybook, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='crew_images/', blank=True, null=True)
    xp = models.IntegerField(default=0)
    xp_track_size = models.IntegerField(default=8)
    advancement_points = models.IntegerField(default=0)

    # Fields for name change consensus
    proposed_name = models.CharField(max_length=100, blank=True, null=True)
    proposed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='proposed_crew_names')
    approved_by = models.ManyToManyField(User, blank=True, related_name='approved_crew_names')

    level = models.IntegerField(default=0)
    hold = models.CharField(max_length=10, choices=[('weak', 'Weak'), ('strong', 'Strong')], default='weak')

    rep = models.IntegerField(default=0)
    wanted_level = models.IntegerField(default=0)

    coin = models.IntegerField(default=0)
    stash = models.IntegerField(default=0)

    claims = models.ManyToManyField(Claim, related_name='crews', blank=True)
    upgrade_progress = models.JSONField(default=dict, help_text="Progress on crew upgrades, e.g., {'Smuggling Tunnels': 2}")
    special_abilities = models.ManyToManyField(CrewSpecialAbility, related_name='crews', blank=True)

    def __str__(self):
        return self.name
