from django.contrib import admin
from .models import Faction, FactionRelationship, CrewFactionRelationship

@admin.register(Faction)
class FactionAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign', 'faction_type', 'level', 'hold', 'reputation')
    list_filter = ('faction_type', 'campaign')
    search_fields = ('name', 'notes')

@admin.register(FactionRelationship)
class FactionRelationshipAdmin(admin.ModelAdmin):
    list_display = ('source_faction', 'target_faction', 'reputation_value')
    list_filter = ('source_faction', 'target_faction')

@admin.register(CrewFactionRelationship)
class CrewFactionRelationshipAdmin(admin.ModelAdmin):
    list_display = ('faction', 'reputation_value') # 'crew' will be added once Crew is moved
    list_filter = ('faction',)
