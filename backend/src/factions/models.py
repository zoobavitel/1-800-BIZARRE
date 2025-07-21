from django.db import models
from campaigns.models import Campaign
# from crews.models import Crew # Will be needed once Crew model is moved

class Faction(models.Model):
    name = models.CharField(max_length=100)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='factions')
    faction_type = models.CharField(max_length=100, blank=True, help_text="A user-defined type for the faction (e.g., 'Criminal Syndicate', 'Ancient Order', 'Merchant Guild').")
    notes = models.TextField(blank=True)
    level = models.IntegerField(default=0)
    hold = models.CharField(max_length=10, choices=[('weak', 'Weak'), ('strong', 'Strong')], default='weak')
    reputation = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.name} ({self.get_faction_type_display()}) - {self.campaign.name}"

class FactionRelationship(models.Model):
    source_faction = models.ForeignKey(Faction, on_delete=models.CASCADE, related_name='outgoing_relationships')
    target_faction = models.ForeignKey(Faction, on_delete=models.CASCADE, related_name='incoming_relationships')
    reputation_value = models.IntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('source_faction', 'target_faction')

    def __str__(self):
        return f"{self.source_faction.name} -> {self.target_faction.name}: {self.reputation_value}"

class CrewFactionRelationship(models.Model):
    # crew = models.ForeignKey('crews.Crew', on_delete=models.CASCADE, related_name='faction_relationships') # Will be uncommented once Crew is moved
    faction = models.ForeignKey(Faction, on_delete=models.CASCADE, related_name='crew_relationships')
    reputation_value = models.IntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        # unique_together = ('crew', 'faction') # Will be uncommented once Crew is moved
        pass

    def __str__(self):
        return f"{self.crew.name} -> {self.faction.name}: {self.reputation_value}"