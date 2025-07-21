from django.db import models
from django.contrib.auth.models import User


class Campaign(models.Model):
    name = models.CharField(max_length=100)
    gm = models.ForeignKey(User, on_delete=models.CASCADE, related_name='campaigns_led')
    players = models.ManyToManyField(User, related_name='campaigns_joined')
    description = models.TextField(blank=True)
    # Wanted stars for campaign (only GM may edit)
    wanted_stars = models.IntegerField(default=0)
    active_session = models.ForeignKey('Session', on_delete=models.SET_NULL, null=True, blank=True, related_name='active_in_campaign')

    def __str__(self):
        return self.name


class Session(models.Model):
    """Tracks individual game sessions or episodes within a campaign."""
    STATUS_CHOICES = [
        ('PLANNED', 'Planned'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
    ]

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='sessions')
    name = models.CharField(max_length=200, help_text="Title or name of the session/episode")
    session_date = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True, help_text="Overall plot or story summary for the session")
    objective = models.TextField(blank=True, help_text="The main goal for this session")
    planned_for_next_session = models.TextField(blank=True, help_text="Notes for the next session")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PLANNED')
    # These will need to be updated to point to the correct apps later
    npcs_involved = models.ManyToManyField('characters.NPC', blank=True, related_name='sessions_involved')
    characters_involved = models.ManyToManyField('characters.Character', blank=True, related_name='sessions_involved')
    factions_involved = models.ManyToManyField('characters.Faction', blank=True, related_name='sessions_involved')

    # Score proposal fields
    proposed_score_target = models.CharField(max_length=200, blank=True, null=True)
    proposed_score_description = models.TextField(blank=True, null=True)
    proposed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='proposed_scores')
    votes = models.ManyToManyField(User, blank=True, related_name='voted_scores')

    def __str__(self):
        return f"{self.campaign.name} - {self.name} ({self.get_status_display()}) - {self.session_date.strftime('%Y-%m-%d')}"


class ChatMessage(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='chat_messages')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='session_chat_messages', null=True, blank=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.timestamp.strftime('%H:%M')}] {self.sender.username}: {self.message[:50]}..."
