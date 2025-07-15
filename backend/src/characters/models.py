from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db.models.signals import post_save
from django.dispatch import receiver
import json


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


class Faction(models.Model):
    FACTION_TYPE_CHOICES = [
        ('CRIMINAL', 'Criminal'),
        ('NOBLE', 'Noble'),
        ('MERCHANT', 'Merchant'),
        ('POLITICAL', 'Political'),
        ('RELIGIOUS', 'Religious'),
        ('OTHER', 'Other'),
    ]

    name = models.CharField(max_length=100)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='factions')
    faction_type = models.CharField(max_length=20, choices=FACTION_TYPE_CHOICES, default='OTHER')
    notes = models.TextField(blank=True)
    level = models.IntegerField(default=0)
    hold = models.CharField(max_length=10, choices=[('weak', 'Weak'), ('strong', 'Strong')], default='weak')
    reputation = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.name} ({self.get_faction_type_display()}) - {self.campaign.name}"




class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    def __str__(self):
        return self.user.username

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
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='crews')
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


class Trauma(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class NPC(models.Model):
    PLAYBOOK_CHOICES = [
        ('STAND','Stand'),
        ('HAMON','Hamon'),
        ('SPIN','Spin'),
    ]
    

    name = models.CharField(max_length=100)
    level = models.IntegerField(default=1)
    appearance = models.TextField(blank=True)
    role = models.CharField(max_length=100, blank=True)
    weakness = models.TextField(blank=True)
    need = models.TextField(blank=True)
    desire = models.TextField(blank=True)
    rumour = models.TextField(blank=True)
    secret = models.TextField(blank=True)
    passion = models.TextField(blank=True)
    description = models.TextField(blank=True)
    stand_coin_stats = models.JSONField(default=dict)
    heritage = models.ForeignKey(Heritage, on_delete=models.SET_NULL, null=True, blank=True)
    playbook = models.CharField(max_length=20, choices=PLAYBOOK_CHOICES, default='STAND')
    custom_abilities = models.TextField(blank=True)
    relationships = models.JSONField(default=dict)
    harm_clock_current = models.IntegerField(default=0)
    vulnerability_clock_current = models.IntegerField(default=0)
    armor_charges = models.IntegerField(default=0)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_npcs')
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True, related_name='npcs')

    # Stand Description Fields
    stand_description = models.TextField(blank=True)
    stand_appearance = models.TextField(blank=True)
    stand_manifestation = models.TextField(blank=True)
    special_traits = models.TextField(blank=True)
    stand_name = models.CharField(max_length=100, blank=True, null=True)

    # New fields for Alonzo Fortuna
    purveyor = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    items = models.JSONField(default=list, blank=True)
    contacts = models.JSONField(default=list, blank=True)
    faction_status = models.JSONField(default=dict, blank=True)
    inventory = models.JSONField(default=list, blank=True)

    harm_clock_max = models.IntegerField(default=4)

    @property
    def special_armor_charges(self):
        durability_grade = self.stand_coin_stats.get('DURABILITY', 'F')
        if durability_grade in ['S', 'A']:
            return 3
        elif durability_grade == 'B':
            return 2
        elif durability_grade in ['C', 'D']:
            return 1
        else: # F
            return 0

    @property
    def vulnerability_clock_max(self):
        durability_grade = self.stand_coin_stats.get('DURABILITY', 'F')
        if durability_grade == 'S':
            return 0  # Indicates a special condition; cannot be defeated by normal harm.
        elif durability_grade == 'A':
            return 12
        elif durability_grade == 'B':
            return 10
        elif durability_grade == 'C':
            return 8
        elif durability_grade == 'D':
            return 6
        elif durability_grade == 'F':
            return 4
        return 0

    @property
    def movement_speed(self):
        speed_grade = self.stand_coin_stats.get('SPEED', 'F')
        if speed_grade == 'S':
            return 200
        elif speed_grade == 'A':
            return 60
        elif speed_grade == 'B':
            return 40
        elif speed_grade == 'C':
            return 35
        elif speed_grade == 'D':
            return 30
        elif speed_grade == 'F':
            return 25
        return 0

    def __str__(self):
        return f"{self.name} (NPC for {self.campaign.name})"


class Ability(models.Model):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50, choices=[("standard", "Standard"), ("other", "Other")])
    description = models.TextField()


class Character(models.Model):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_data = {field.name: getattr(self, field.name) for field in self._meta.fields}

    def save(self, *args, **kwargs):
        if self.pk:  # Only enforce for existing objects (not on creation)
            for field_name in self.gm_locked_fields:
                if field_name in self._original_data and getattr(self, field_name) != self._original_data[field_name]:
                    raise ValidationError(f'Field \'{field_name}\' is locked by the GM and cannot be changed.')
        super().save(*args, **kwargs)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True, related_name='characters')
    crew = models.ForeignKey(Crew, on_delete=models.SET_NULL, null=True, blank=True, related_name='members')

    true_name = models.CharField(max_length=100)
    alias = models.CharField(max_length=100, blank=True, null=True)
    appearance = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='character_images/', blank=True, null=True)

    @property
    def development_xp_bonus(self):
        if not hasattr(self, 'stand'):
            return 0  # Or handle as an error, depending on game rules for non-Stand users

        dev_grade = self.stand.development
        if dev_grade == 'S':
            return 5
        elif dev_grade == 'A':
            return 4
        elif dev_grade == 'B':
            return 3
        elif dev_grade == 'C':
            return 2
        elif dev_grade == 'D':
            return 1
        else:  # F or other
            return 0

    @property
    def level(self):
        return 1 + (self.total_xp_spent // 10)
    level = models.IntegerField(default=1)

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
    total_xp_spent = models.IntegerField(default=0)
    heritage_points_gained = models.IntegerField(default=0)
    stand_coin_points_gained = models.IntegerField(default=0)
    action_dice_gained = models.IntegerField(default=0)
    inventory = models.JSONField(default=list, blank=True, help_text="List of items the character possesses")
    reputation_status = models.JSONField(default=dict, blank=True, help_text="Tracks character's reputation with allies, rivals, and factions (e.g., {'Faction Name': 2, 'NPC Name': -1})")

    ACTION_CATEGORIES = {
        'insight': ['hunt', 'study', 'survey', 'tinker'],
        'prowess': ['finesse', 'prowl', 'skirmish', 'wreck'],
        'resolve': ['attune', 'command', 'consort', 'sway'],
    }

    def _calculate_attribute_rating(self, actions):
        rating = 0
        for action in actions:
            if self.action_dots.get(action, 0) > 0:
                rating += 1
        return rating

    @property
    def insight_attribute_rating(self):
        return self._calculate_attribute_rating(self.ACTION_CATEGORIES['insight'])

    @property
    def prowess_attribute_rating(self):
        return self._calculate_attribute_rating(self.ACTION_CATEGORIES['prowess'])

    @property
    def resolve_attribute_rating(self):
        return self._calculate_attribute_rating(self.ACTION_CATEGORIES['resolve'])

    @property
    def total_abilities_count(self):
        count = self.standard_abilities.count()
        if self.custom_ability_description:
            count += 1
        # Assuming hamon_abilities and spin_abilities are related managers
        count += self.hamon_abilities.count()
        count += self.spin_abilities.count()
        return count

    def clean(self):
        super().clean()
        self._validate_initial_abilities_count()
        self._validate_xp_advancements()

        # Validate A-rank abilities if a Stand exists
        if hasattr(self, 'stand'):
            self._validate_a_rank_abilities()

    def _validate_level_1_creation(self):
        self._validate_action_dots_distribution()
        self._validate_stand_coin_stats()
        self._validate_stress_based_on_durability()
        self._validate_standard_abilities_count()

    def _validate_action_dots_distribution(self):
        total_dots = sum(self.action_dots.values())
        if total_dots != 7:
            raise ValidationError(
                {'action_dots': 'A new character at level 1 must have exactly 7 action dots.'}
            )
        for action, dots in self.action_dots.items():
            if self.level == 1 and dots > 2:  # Max 2 dots per action at level 1
                raise ValidationError(
                    {'action_dots': f'Action "{action}" cannot have more than 2 dots at level 1.'}
                )
            elif self.level > 1 and dots > 4: # Max 4 dots per action after level 1
                raise ValidationError(
                    {'action_dots': f'Action "{action}" cannot have more than 4 dots.'}
                )

    def _validate_stand_coin_stats(self):
        grade_points = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0}
        total_stand_coin_points = 0
        
        # Ensure stand exists and has coin_stats
        if not hasattr(self, 'stand') or not self.stand.coin_stats:
            raise ValidationError(
                {'stand': 'A level 1 character must have a Stand with coin stats defined.'}
            )

        for stat, grade in self.stand.coin_stats.items():
            if grade not in grade_points:
                raise ValidationError(
                    {'stand_coin_stats': f'Invalid grade "{grade}" for stat "{stat}". Must be S, A, B, C, D, or F.'}
                )
            if grade == 'S' and not self.gm_can_have_s_rank_stand_stats:
                raise ValidationError(
                    {'stand_coin_stats': f'Player characters cannot have S-rank in {stat} unless explicitly allowed by the GM.'}
                )
            total_stand_coin_points += grade_points[grade]

        if total_stand_coin_points != 10:
            raise ValidationError(
                {'stand_coin_stats': f'A new character at level 1 must have exactly 10 Stand Coin points. Current total: {total_stand_coin_points}.'}
            )

    def _validate_stress_based_on_durability(self):
        expected_stress = 9
        durability_grade = self.stand.coin_stats.get('DURABILITY') if hasattr(self, 'stand') else None

        if durability_grade == 'S':
            expected_stress = 13
        elif durability_grade == 'A':
            expected_stress = 12
        elif durability_grade == 'B':
            expected_stress = 11
        elif durability_grade == 'C':
            expected_stress = 10
        elif durability_grade == 'D':
            expected_stress = 9
        elif durability_grade == 'F':
            expected_stress = 8
        
        if self.stress != expected_stress:
            raise ValidationError(
                {'stress': f'Stress must be {expected_stress} for a level 1 character with {durability_grade} Stand Durability.'}
            )

    def _validate_initial_abilities_count(self):
        if self.total_abilities_count != 3:
            raise ValidationError(
                {'standard_abilities': 'A new character at level 1 must have exactly 3 abilities (standard, custom, or playbook).', 'total_abilities_count': self.total_abilities_count}
            )

    def _validate_a_rank_abilities(self):
        if not hasattr(self, 'stand') or not self.stand.coin_stats:
            return # No stand, no A-rank ability validation

        a_rank_count = 0
        for grade in self.stand.coin_stats.values():
            if grade == 'A':
                a_rank_count += 1

        expected_abilities_from_a_ranks = a_rank_count * 2
        # This assumes initial 3 abilities are already accounted for in total_abilities_count
        # and that A-ranks grant *additional* abilities.
        # The total abilities should be 3 (initial) + expected_abilities_from_a_ranks
        expected_total_abilities = 3 + expected_abilities_from_a_ranks

        if self.total_abilities_count != expected_total_abilities:
            raise ValidationError(
                {'total_abilities_count': f'Total abilities ({self.total_abilities_count}) does not match expected abilities ({expected_total_abilities}) based on A-rank Stand stats.'}
            )

    def _validate_xp_advancements(self):
        # Ensure total_xp_spent is a multiple of 10
        if self.total_xp_spent % 10 != 0:
            raise ValidationError(
                {'total_xp_spent': 'Total XP spent must be a multiple of 10 for advancements.'}
            )

        # Calculate expected total XP from advancements
        expected_xp_from_advancements = (
            self.heritage_points_gained * 5 +  # 5 XP per heritage point
            self.stand_coin_points_gained * 10 + # 10 XP per stand coin point
            self.action_dice_gained * 5  # 5 XP per action die
        )

        if self.total_xp_spent != expected_xp_from_advancements:
            raise ValidationError(
                {'total_xp_spent': f'Total XP spent ({self.total_xp_spent}) does not match XP calculated from advancements ({expected_xp_from_advancements}).'}
            )

        # Ensure gained values are non-negative
        if self.action_dice_gained < 0:
            raise ValidationError(
                {'action_dice_gained': 'Action dice gained cannot be negative.'}
            )
        if self.stand_coin_points_gained < 0:
            raise ValidationError(
                {'stand_coin_points_gained': 'Stand coin points gained cannot be negative.'}
            )
        if self.heritage_points_gained < 0:
            raise ValidationError(
                {'heritage_points_gained': 'Heritage points gained cannot be negative.'}
            )

    def gain_xp(self, xp_amount, xp_type):
        if xp_type not in self.xp_clocks:
            self.xp_clocks[xp_type] = 0
        self.xp_clocks[xp_type] += xp_amount
        self.save()

    def spend_xp_for_action_dice(self, xp_type, num_dice):
        xp_cost = num_dice * 5
        if self.xp_clocks.get(xp_type, 0) < xp_cost:
            raise ValidationError(f'Not enough XP in {xp_type} to gain {num_dice} action dice.')
        
        self.xp_clocks[xp_type] -= xp_cost
        self.total_xp_spent += xp_cost
        self.action_dice_gained += num_dice
        self.save()

    def spend_xp_for_stand_coin(self, xp_type, num_points):
        xp_cost = num_points * 10
        if self.xp_clocks.get(xp_type, 0) < xp_cost:
            raise ValidationError(f'Not enough XP in {xp_type} to gain {num_points} Stand Coin points.')
        
        self.xp_clocks[xp_type] -= xp_cost
        self.total_xp_spent += xp_cost
        self.stand_coin_points_gained += num_points
        self.save()

    def spend_xp_for_heritage_point(self, xp_type, num_points):
        xp_cost = num_points * 5
        if self.xp_clocks.get(xp_type, 0) < xp_cost:
            raise ValidationError(f'Not enough XP in {xp_type} to gain {num_points} Heritage points.')
        
        self.xp_clocks[xp_type] -= xp_cost
        self.total_xp_spent += xp_cost
        self.heritage_points_gained += num_points
        self.save()

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
    development_temporary_ability = models.JSONField(default=None, null=True, blank=True, help_text="Temporary ability gained from A-rank Development Potential until the end of the session")
    
    # Faction reputation tracking - list of {name: str, rep: int} objects
    faction_reputation = models.JSONField(default=list, blank=True, null=True)
    
    # GM settings for character creation locking
    gm_character_locked = models.BooleanField(default=False)
    gm_allowed_edit_fields = models.JSONField(default=dict, blank=True, null=True)
    gm_can_have_s_rank_stand_stats = models.BooleanField(default=False)
    gm_locked_fields = models.JSONField(default=list, blank=True, help_text="List of fields locked by the GM (e.g., ['level', 'action_dots'])")


class CharacterHistory(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='history_entries')
    editor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    changed_fields = models.JSONField()
    
    def __str__(self):
        return f"Changes for {self.character.true_name} at {self.timestamp}"

@receiver(post_save, sender=Character)
def log_character_changes(sender, instance, created, **kwargs):
    if created:
        # Don't log creation as a change
        return

    try:
        latest_history = CharacterHistory.objects.filter(character=instance).latest('timestamp')
        old_data = latest_history.changed_fields
    except CharacterHistory.DoesNotExist:
        old_data = {}

    new_data = {}
    for field in instance._meta.fields:
        new_data[field.name] = str(getattr(instance, field.name))

    changed_fields = {}
    for field_name, new_value in new_data.items():
        if old_data.get(field_name) != new_value:
            changed_fields[field_name] = {
                'old': old_data.get(field_name),
                'new': new_value
            }

    if changed_fields:
        CharacterHistory.objects.create(
            character=instance,
            changed_fields=changed_fields
        )



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


class HamonAbility(models.Model):
    """Hamon abilities for Hamon playbook users based on SRD."""
    
    HAMON_TYPE_CHOICES = [
        ('FOUNDATION', 'Foundation Hamon'),
        ('TRADITIONALIST', 'Traditionalist (Zeppeli Style)'),
        ('MEDICAL', 'Medical Hamon'),
        ('MARTIAL', 'Martial Hamon'),
        ('INVESTIGATIVE', 'Investigative Hamon'),
    ]
    
    name = models.CharField(max_length=100)
    hamon_type = models.CharField(max_length=20, choices=HAMON_TYPE_CHOICES)
    description = models.TextField()
    stress_cost = models.IntegerField(default=0, help_text="Stress cost to use this ability")
    frequency = models.CharField(max_length=50, blank=True, help_text="Usage frequency (e.g., 'Once per score')")
    
    def __str__(self):
        return f"{self.name} ({self.get_hamon_type_display()})"


class SpinAbility(models.Model):
    """Spin abilities for Spin playbook users based on SRD."""
    
    SPIN_TYPE_CHOICES = [
        ('FOUNDATION', 'Spin Foundation'),
        ('CAVALIER', 'Cavalier'),
        ('ARCHITECT', 'Architect'),
        ('GUNSLINGER', 'Gunslinger'),
        ('TUSK', 'Tusk'),
    ]
    
    name = models.CharField(max_length=100)
    spin_type = models.CharField(max_length=20, choices=SPIN_TYPE_CHOICES)
    description = models.TextField()
    stress_cost = models.IntegerField(default=0, help_text="Stress cost to use this ability")
    frequency = models.CharField(max_length=50, blank=True, help_text="Usage frequency (e.g., 'Once per scene')")
    
    def __str__(self):
        return f"{self.name} ({self.get_spin_type_display()})"


class CharacterHamonAbility(models.Model):
    """Junction table for characters and their selected Hamon abilities."""
    character = models.ForeignKey('Character', on_delete=models.CASCADE, related_name='hamon_abilities')
    hamon_ability = models.ForeignKey(HamonAbility, on_delete=models.CASCADE)
    acquired_at_creation = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('character', 'hamon_ability')


class CharacterSpinAbility(models.Model):
    """Junction table for characters and their selected Spin abilities."""
    character = models.ForeignKey('Character', on_delete=models.CASCADE, related_name='spin_abilities')
    spin_ability = models.ForeignKey(SpinAbility, on_delete=models.CASCADE)
    acquired_at_creation = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('character', 'spin_ability')


class ProgressClock(models.Model):
    """Progress clocks for tracking ongoing activities based on SRD."""
    
    CLOCK_TYPE_CHOICES = [
        ('PROJECT', 'Long-term Project'),
        ('HEALING', 'Healing Clock'),
        ('COUNTDOWN', 'Countdown Clock'),
        ('CUSTOM', 'Custom Clock'),
    ]
    
    name = models.CharField(max_length=100)
    clock_type = models.CharField(max_length=20, choices=CLOCK_TYPE_CHOICES)
    max_segments = models.IntegerField(default=4, help_text="Total number of segments (4, 6, or 8)")
    filled_segments = models.IntegerField(default=0, help_text="Currently filled segments")
    description = models.TextField(blank=True)
    
    # Can be associated with campaigns, crews, or characters
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True, related_name='progress_clocks')
    crew = models.ForeignKey(Crew, on_delete=models.CASCADE, null=True, blank=True, related_name='progress_clocks')
    character = models.ForeignKey('Character', on_delete=models.CASCADE, null=True, blank=True, related_name='progress_clocks')
    faction = models.ForeignKey(Faction, on_delete=models.CASCADE, null=True, blank=True, related_name='progress_clocks')
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.name} ({self.filled_segments}/{self.max_segments})"
    
    @property
    def progress_percentage(self):
        return (self.filled_segments / self.max_segments) * 100 if self.max_segments > 0 else 0


class ExperienceTracker(models.Model):
    """Track experience points and advancement based on SRD rules."""
    
    XP_TRIGGER_CHOICES = [
        ('BELIEFS', 'Express beliefs, drives, heritage, or background'),
        ('STRUGGLE', 'Struggle with issues from vice or trauma'),
        ('DESPERATE', 'Address a challenge with action rating 0'),
        ('STANDOUT', 'Standout action or leadership'),
    ]
    
    character = models.ForeignKey('Character', on_delete=models.CASCADE, related_name='experience_entries')
    session = models.ForeignKey('Session', on_delete=models.SET_NULL, null=True, blank=True, related_name='xp_entries')
    session_date = models.DateTimeField(auto_now_add=True)
    trigger = models.CharField(max_length=20, choices=XP_TRIGGER_CHOICES)
    description = models.TextField(help_text="What did the character do to earn this XP?")
    xp_gained = models.IntegerField(default=1)
    
    def __str__(self):
        return f"{self.character.true_name} - {self.get_trigger_display()} ({self.xp_gained} XP)"


class DowntimeActivity(models.Model):
    """Track downtime activities between scores based on SRD."""
    
    ACTIVITY_TYPE_CHOICES = [
        ('ACQUIRE_ASSET', 'Acquire Asset'),
        ('LONG_TERM_PROJECT', 'Long-term Project'),
        ('RECOVER', 'Recover'),
        ('REDUCE_HEAT', 'Reduce Heat'),
        ('TRAIN', 'Train'),
        ('INDULGE_VICE', 'Indulge Vice'),
        ('REDUCE_WANTED_LEVEL', 'Reduce Wanted Level'),
    ]
    
    character = models.ForeignKey('Character', on_delete=models.CASCADE, related_name='downtime_activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPE_CHOICES)
    description = models.TextField()
    result = models.TextField(blank=True, help_text="What was the outcome?")
    stress_relieved = models.IntegerField(default=0)
    harm_healed = models.IntegerField(default=0)
    progress_made = models.IntegerField(default=0, help_text="Progress ticks on clocks")
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.character.true_name} - {self.get_activity_type_display()}"


class Score(models.Model):
    """Track scores (jobs/missions) for crews based on SRD."""
    
    SCORE_TYPE_CHOICES = [
        ('ASSAULT', 'Assault'),
        ('DECEPTION', 'Deception'),
        ('STEALTH', 'Stealth'),
        ('OCCULT', 'Occult'),
        ('SOCIAL', 'Social'),
        ('TRANSPORT', 'Transport'),
    ]
    
    crew = models.ForeignKey(Crew, on_delete=models.CASCADE, related_name='scores')
    name = models.CharField(max_length=100)
    score_type = models.CharField(max_length=20, choices=SCORE_TYPE_CHOICES)
    target = models.CharField(max_length=100, help_text="What/who is the target?")
    description = models.TextField()
    
    rep_gained = models.IntegerField(default=0)
    coin_gained = models.IntegerField(default=0)
    heat_gained = models.IntegerField(default=0)
    
    completed = models.BooleanField(default=False)
    success_level = models.CharField(max_length=50, blank=True, help_text="How well did it go?")
    consequences = models.TextField(blank=True, help_text="What complications arose?")
    
    participants = models.ManyToManyField('Character', related_name='scores_participated')
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.crew.name} - {self.name}"


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
    npcs_involved = models.ManyToManyField(NPC, blank=True, related_name='sessions_involved')
    characters_involved = models.ManyToManyField(Character, blank=True, related_name='sessions_involved')
    factions_involved = models.ManyToManyField(Faction, blank=True, related_name='sessions_involved')

    # Score proposal fields
    proposed_score_target = models.CharField(max_length=200, blank=True, null=True)
    proposed_score_description = models.TextField(blank=True, null=True)
    proposed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='proposed_scores')
    votes = models.ManyToManyField(User, blank=True, related_name='voted_scores')

    def __str__(self):
        return f"{self.campaign.name} - {self.name} ({self.get_status_display()}) - {self.session_date.strftime('%Y-%m-%d')}"


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
    crew = models.ForeignKey(Crew, on_delete=models.CASCADE, related_name='faction_relationships')
    faction = models.ForeignKey(Faction, on_delete=models.CASCADE, related_name='crew_relationships')
    reputation_value = models.IntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('crew', 'faction')

    def __str__(self):
        return f"{self.crew.name} -> {self.faction.name}: {self.reputation_value}"


class SessionEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('DICE_ROLL', 'Dice Roll'),
        ('STRESS_CHANGE', 'Stress Change'),
        ('HARM_APPLIED', 'Harm Applied'),
        ('ITEM_ACQUIRED', 'Item Acquired'),
        ('DEVILS_BARGAIN', 'Devil\'s Bargain'),
        ('LOCATION_CHANGE', 'Location Change'),
        ('ARMOR_EXPENDITURE', 'Armor Expenditure'), # New choice
        ('OTHER', 'Other'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='events')
    character = models.ForeignKey(Character, on_delete=models.CASCADE, null=True, blank=True, related_name='session_events')
    npc = models.ForeignKey(NPC, on_delete=models.CASCADE, null=True, blank=True, related_name='session_events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    details = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.session.name} - {self.get_event_type_display()} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"


class XPHistory(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='xp_history')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='session_xp_history', null=True, blank=True)
    amount = models.IntegerField()
    reason = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.character.true_name} gained {self.amount} XP ({self.reason}) on {self.timestamp.strftime('%Y-%m-%d')}"

class StressHistory(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='stress_history')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='session_stress_history', null=True, blank=True)
    amount = models.IntegerField(help_text="Change in stress (positive for gain, negative for relief)")
    reason = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.character.true_name} stress changed by {self.amount} ({self.reason}) on {self.timestamp.strftime('%Y-%m-%d')}"

class ChatMessage(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='chat_messages')
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='session_chat_messages', null=True, blank=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.timestamp.strftime('%H:%M')}] {self.sender.username}: {self.message[:50]}..."

