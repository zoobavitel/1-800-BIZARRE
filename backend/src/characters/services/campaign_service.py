from django.db import models
from django.core.exceptions import PermissionDenied
from ..models import Campaign, Character, NPC


class CampaignService:
    """Service class for campaign-related business logic."""
    
    @staticmethod
    def create_campaign(user, campaign_data):
        """Create a new campaign with the user as GM."""
        campaign = Campaign.objects.create(
            gm=user,
            **campaign_data
        )
        return campaign
    
    @staticmethod
    def get_user_campaigns(user):
        """Get all campaigns for a user (as GM or member)."""
        if user.is_staff:
            return Campaign.objects.all()
        
        return Campaign.objects.filter(
            models.Q(gm=user) | models.Q(characters__user=user)
        ).distinct()
    
    @staticmethod
    def can_edit_campaign(user, campaign):
        """Check if a user can edit a campaign."""
        return user == campaign.gm or user.is_staff
    
    @staticmethod
    def add_character_to_campaign(campaign, character):
        """Add a character to a campaign."""
        character.campaign = campaign
        character.save()
        return character
    
    @staticmethod
    def remove_character_from_campaign(campaign, character):
        """Remove a character from a campaign."""
        if character.campaign == campaign:
            character.campaign = None
            character.save()
        return character
    
    @staticmethod
    def get_campaign_characters(campaign, user=None):
        """Get all characters in a campaign."""
        characters = campaign.characters.all()
        
        # Filter by user if specified
        if user and not user.is_staff:
            characters = characters.filter(user=user)
        
        return characters
    
    @staticmethod
    def get_campaign_npcs(campaign, user=None):
        """Get all NPCs in a campaign."""
        npcs = NPC.objects.filter(campaign=campaign)
        
        # Filter by user permissions
        if user and not user.is_staff:
            # Only GMs can see NPCs
            if campaign.gm != user:
                npcs = npcs.none()
        
        return npcs
    
    @staticmethod
    def update_campaign(campaign, campaign_data, user):
        """Update a campaign."""
        if not CampaignService.can_edit_campaign(user, campaign):
            raise PermissionDenied("Only the GM can update this campaign")
        
        for field, value in campaign_data.items():
            setattr(campaign, field, value)
        campaign.save()
        
        return campaign
    
    @staticmethod
    def delete_campaign(campaign, user):
        """Delete a campaign."""
        if not CampaignService.can_edit_campaign(user, campaign):
            raise PermissionDenied("Only the GM can delete this campaign")
        
        campaign.delete()
        return True 