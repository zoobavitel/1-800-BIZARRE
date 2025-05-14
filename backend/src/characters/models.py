from django.db import models
from django.contrib.auth.models import User


class Campaign(models.Model):
    name = models.CharField(max_length=100)
    gm = models.ForeignKey(User, on_delete=models.CASCADE, related_name='campaigns_led')
    players = models.ManyToManyField(User, related_name='campaigns_joined')
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Crew(models.Model):
    name = models.CharField(max_length=100)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='crews')
    description = models.TextField(blank=True)

    tier = models.IntegerField(default=0)
    hold = models.CharField(max_length=10, choices=[('weak', 'Weak'), ('strong', 'Strong')], default='weak')

    rep = models.IntegerField(default=0)
    heat = models.IntegerField(default=0)
    wanted_level = models.IntegerField(default=0)

    coin = models.IntegerField(default=0)
    stash = models.IntegerField(default=0)

    claims = models.JSONField(default=dict)
    upgrades = models.JSONField(default=list)

    def __str__(self):
        return self.name


class Heritage(models.Model):
    name = models.CharField(max_length=50)
    base_hp = models.IntegerField(default=0)
    description = models.TextField(blank=True)


class Detriment(models.Model):
    heritage = models.ForeignKey(Heritage, on_delete=models.CASCADE, related_name='detriments')
    name = models.CharField(max_length=100)
    hp_value = models.IntegerField()
    required = models.BooleanField(default=False)
    description = models.TextField()


class Benefit(models.Model):
    heritage = models.ForeignKey(Heritage, on_delete=models.CASCADE, related_name='benefits')
    name = models.CharField(max_length=100)
    hp_cost = models.IntegerField()
    required = models.BooleanField(default=False)
    description = models.TextField()


class Vice(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class NPC(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='npcs')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    stats = models.JSONField(default=dict)

    def __str__(self):
        return f"{self.name} (NPC for {self.campaign.name})"


class Ability(models.Model):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50, choices=[("standard", "Standard"), ("other", "Other")])
    description = models.TextField()


class Character(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    campaign = models.ForeignKey(Campaign, on_delete=models.SET_NULL, null=True, blank=True, related_name='characters')
    crew = models.ForeignKey(Crew, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')

    true_name = models.CharField(max_length=100)
    alias = models.CharField(max_length=100, blank=True, null=True)
    appearance = models.TextField(blank=True, null=True)

    heritage = models.ForeignKey(Heritage, on_delete=models.SET_NULL, null=True)
    selected_benefits = models.ManyToManyField(Benefit, blank=True, related_name='characters')
    selected_detriments = models.ManyToManyField(Detriment, blank=True, related_name='characters')
    bonus_hp_from_xp = models.IntegerField(default=0)

    background_note = models.TextField(blank=True, null=True)
    background_note2 = models.TextField(blank=True, null=True)

    action_dots = models.JSONField(default=dict)
    playbook = models.CharField(max_length=20, choices=[('STAND','Stand'),('HAMON','Hamon'),('SPIN','Spin')], default='STAND')

    stand_type = models.CharField(max_length=50, blank=True, null=True)
    stand_name = models.CharField(max_length=100, blank=True, null=True)
    stand_form = models.TextField(blank=True, null=True)
    stand_conscious = models.BooleanField(default=True)
    coin_stats = models.JSONField(default=dict)

    armor_type = models.CharField(
        max_length=20,
        choices=[('LIGHT','Light'),('MEDIUM','Medium'),('HEAVY','Heavy'),('ENCUMBERED','Encumbered')],
        blank=True,
        null=True
    )

    close_friend = models.CharField(max_length=100, blank=True)
    rival = models.CharField(max_length=100, blank=True)

    vice = models.ForeignKey(Vice, on_delete=models.SET_NULL, null=True)
    vice_details = models.TextField(blank=True, null=True)

    loadout = models.IntegerField(default=1)

    stress = models.IntegerField(default=0)
    trauma = models.JSONField(default=list)
    healing_clock_segments = models.IntegerField(default=4)
    healing_clock_filled = models.IntegerField(default=0)

    light_armor_used = models.BooleanField(default=False)
    medium_armor_used = models.BooleanField(default=False)
    heavy_armor_used = models.BooleanField(default=False)

    harm_level1_used = models.BooleanField(default=False)
    harm_level1_name = models.CharField(max_length=100, blank=True, null=True)
    harm_level2_used = models.BooleanField(default=False)
    harm_level2_name = models.CharField(max_length=100, blank=True, null=True)
    harm_level3_used = models.BooleanField(default=False)
    harm_level3_name = models.CharField(max_length=100, blank=True, null=True)
    harm_level4_used = models.BooleanField(default=False)
    harm_level4_name = models.CharField(max_length=100, blank=True, null=True)

    xp_clocks = models.JSONField(default=dict)

    # Custom Ability Description (editable by GM and user)
    custom_ability_description = models.TextField(blank=True, null=True)
    
    # Type of Custom Ability
    CUSTOM_ABILITY_CHOICES = [
        ('single_with_3_uses', 'Single Ability with 3 Uses'),
        ('three_separate_uses', 'Three Separate Abilities'),
    ]
    custom_ability_type = models.CharField(
        max_length=32,
        choices=CUSTOM_ABILITY_CHOICES,
        default='single_with_3_uses'
    )

    # Standard Abilities chosen by user
    standard_abilities = models.ManyToManyField(Ability, blank=True, related_name='characters_standard')

    # JSON field to store additional abilities based on "A" grade logic
    extra_custom_abilities = models.JSONField(default=list, blank=True, null=True)



class Stand(models.Model):
    TYPE_CHOICES = [
        ('COLONY', 'Colony Stand'),
        ('TOOLBOUND', 'Tool Bound'),
        ('PHENOMENA', 'Phenomena'),
        ('AUTOMATIC', 'Automatic'),
        ('FIGHTING', 'Fighting Spirit'),
    ]

    FORM_CHOICES = [
        ('Humanoid','Humanoid'),
        ('Non-Humanoid','Non-Humanoid'),
        ('Phenomenon','Phenomenon'),
    ]
    GRADE_CHOICES = [
        ('S','S - Exceptional'),
        ('A','A - Elite'),
        ('B','B - Skilled'),
        ('C','C - Average'),
        ('D','D - Below Average'),
        ('F','F - Flawed'),
    ]

    character = models.OneToOneField('Character', on_delete=models.CASCADE, related_name='stand')

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    form = models.CharField(max_length=30, choices=FORM_CHOICES)
    consciousness_level = models.CharField(max_length=1, choices=[(x,x) for x in 'ABCDEF'])

    power = models.CharField(max_length=1, choices=GRADE_CHOICES)
    speed = models.CharField(max_length=1, choices=GRADE_CHOICES)
    range = models.CharField(max_length=1, choices=GRADE_CHOICES)
    durability = models.CharField(max_length=1, choices=GRADE_CHOICES)
    precision = models.CharField(max_length=1, choices=GRADE_CHOICES)
    development = models.CharField(max_length=1, choices=GRADE_CHOICES)

    armor = models.IntegerField(default=0)
    standard_ability = models.ForeignKey('Ability', on_delete=models.SET_NULL, null=True, blank=True, related_name='stand_default')


class StandAbility(models.Model):
    stand = models.ForeignKey(Stand, on_delete=models.CASCADE, related_name='abilities')

    name = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return f"{self.name} ({self.stand.name})"

