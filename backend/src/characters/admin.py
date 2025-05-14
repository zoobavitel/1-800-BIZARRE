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

# Register other models
admin.site.register(Vice)
admin.site.register(Ability)
admin.site.register(Stand)
admin.site.register(Campaign)
admin.site.register(Crew)
admin.site.register(NPC)
