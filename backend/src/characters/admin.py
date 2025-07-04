from django.contrib import admin
from .models import (
    Heritage, Benefit, Detriment,
    Character, Vice, Ability, Stand,
    Campaign, Crew, NPC
)

# Inline editing for Benefits and Detriments on Heritage admin
class BenefitInline(admin.TabularInline):
    model = Benefit
    extra = 1

class DetrimentInline(admin.TabularInline):
    model = Detriment
    extra = 1

@admin.register(Heritage)
class HeritageAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_hp')
    inlines = [BenefitInline, DetrimentInline]

@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ('true_name', 'user', 'heritage', 'campaign', 'crew')
    filter_horizontal = ('selected_benefits', 'selected_detriments')
    fieldsets = (
        (None, {
            'fields': (
                'user', 'true_name', 'alias',
                'campaign', 'crew', 'heritage', 'vice'
            )
        }),
        ('Background', {
            'fields': ('background_note', 'background_note2')
        }),
        ('Stats', {
            'fields': ('action_dots', 'coin_stats', 'bonus_hp_from_xp')
        }),
        ('Supernatural', {
            'fields': (
                'playbook',
                'stand_type', 'stand_name', 'stand_form', 'stand_conscious',
                'special_ability', 'armor_type'
            )
        }),
        ('Relationships', {
            'fields': ('close_friend', 'rival')
        }),
        ('Appearance & Loadout', {
            'fields': ('appearance', 'loadout')
        }),
        ('Game State', {
            'fields': (
                'stress', 'trauma',
                'healing_clock_segments', 'healing_clock_filled',
                'light_armor_used', 'medium_armor_used', 'heavy_armor_used',
                'harm_level1_used', 'harm_level1_name',
                'harm_level2_used', 'harm_level2_name',
                'harm_level3_used', 'harm_level3_name',
                'harm_level4_used', 'harm_level4_name',
                'xp_clocks'
            )
        }),
    )

@admin.register(NPC)
class NPCAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign', 'creator', 'playbook', 'level', 'harm_clock_current', 'vulnerability_clock_current', 'armor_charges')
    list_filter = ('playbook', 'campaign', 'creator', 'level')
    search_fields = ('name', 'description', 'stand_description')
    fieldsets = (
        (None, {
            'fields': ('name', 'level', 'creator', 'campaign')
        }),
        ('Appearance & Role', {
            'fields': ('appearance', 'role', 'description')
        }),
        ('Narrative Elements', {
            'fields': ('weakness', 'need', 'desire', 'rumour', 'secret', 'passion')
        }),
        ('Game Mechanics', {
            'fields': ('heritage', 'playbook', 'stand_coin_stats', 'custom_abilities', 'relationships')
        }),
        ('Clocks & Armor', {
            'fields': ('harm_clock_current', 'vulnerability_clock_current', 'armor_charges')
        }),
        ('Stand Description', {
            'fields': ('stand_description', 'stand_appearance', 'stand_manifestation', 'special_traits')
        }),
        ('Additional Details', {
            'fields': ('purveyor', 'notes', 'items', 'contacts', 'faction_status', 'inventory')
        }),
    )


# Register other models
admin.site.register(Vice)
admin.site.register(Ability)
admin.site.register(Stand)
admin.site.register(Campaign)
admin.site.register(Crew)
