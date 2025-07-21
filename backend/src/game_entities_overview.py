"""
COMPREHENSIVE OVERVIEW OF 1-800-BIZARRE GAME ENTITIES AND QUALITIES
================================================================

This document provides a complete breakdown of all game entities, their properties,
and how they interact within the 1-800-BIZARRE system.
"""

# ============================================================================
# 1. GAME MASTER (GM) - User with special permissions
# ============================================================================
"""
GM QUALITIES:
- User account with special permissions
- Can create and manage campaigns
- Can edit campaign-level settings (wanted_stars)
- Can lock/unlock character fields
- Can approve crew name changes
- Can assign characters and NPCs to campaigns
- Can create and manage NPCs
- Can override character creation rules (e.g., allow S-rank Stand stats)
- Can view all character history and changes
- Can manage faction relationships
"""

# ============================================================================
# 2. PLAYER CHARACTER (Character Model)
# ============================================================================
"""
PLAYER CHARACTER QUALITIES:

CORE IDENTITY:
- true_name: Character's real name
- alias: Alternative identity
- appearance: Physical description
- background_note: Character background
- user: Associated player account
- campaign: Which campaign they belong to
- crew: Which crew they belong to (optional)

HERITAGE & RACIAL TRAITS:
- heritage: Race/species (Human, Vampire, etc.)
- selected_benefits: Chosen heritage benefits
- selected_detriments: Chosen heritage detriments
- bonus_hp_from_xp: Additional HP from XP spending

PLAYBOOK & ABILITIES:
- playbook: Character type (STAND, HAMON, SPIN)
- standard_abilities: Chosen standard abilities
- custom_ability_description: Custom ability text
- custom_ability_type: How custom ability works
- hamon_abilities: Chosen Hamon abilities
- spin_abilities: Chosen Spin abilities
- extra_custom_abilities: Additional abilities from A-rank stats

ACTION RATINGS & ATTRIBUTES:
- action_dots: JSON field with action ratings
  * insight: hunt, study, survey, tinker
  * prowess: finesse, prowl, skirmish, wreck  
  * resolve: attune, command, consort, sway
- insight_attribute_rating: Calculated from insight actions
- prowess_attribute_rating: Calculated from prowess actions
- resolve_attribute_rating: Calculated from resolve actions

STAND & COIN STATS:
- stand_name: Stand's name
- stand_form: Stand's appearance
- stand_conscious: Whether Stand is conscious
- coin_stats: JSON field with Stand stats (Power, Speed, Range, Durability, Precision, Development)
- stand_type: Type of Stand (COLONY, TOOLBOUND, etc.)

STRESS & TRAUMA SYSTEM:
- stress: Current stress level (8-13 based on Durability)
- trauma: List of trauma conditions
- healing_clock_segments: Total healing clock segments
- healing_clock_filled: Current healing progress

ARMOR & RESISTANCE:
- armor_type: LIGHT, MEDIUM, HEAVY, ENCUMBERED
- light_armor_used: Whether light armor is active
- medium_armor_used: Whether medium armor is active
- heavy_armor_used: Whether heavy armor is active

HARM SYSTEM:
- harm_level1_used through harm_level4_used: Harm slots
- harm_level1_name through harm_level4_name: Harm descriptions

EXPERIENCE & ADVANCEMENT:
- level: Character level (calculated from XP spent)
- xp_clocks: JSON field tracking XP by type
- total_xp_spent: Total XP spent on advancements
- heritage_points_gained: Heritage points from XP
- stand_coin_points_gained: Stand coin points from XP
- action_dice_gained: Action dice from XP

INVENTORY & RESOURCES:
- loadout: Equipment load
- inventory: JSON list of items
- reputation_status: JSON tracking reputation with factions/NPCs

VICE & RELATIONSHIPS:
- vice: Character's vice
- vice_details: Details about the vice
- close_friend: Character's close friend
- rival: Character's rival

GM CONTROLS:
- gm_character_locked: Whether character is locked by GM
- gm_allowed_edit_fields: Fields GM allows editing
- gm_can_have_s_rank_stand_stats: Can have S-rank stats
- gm_locked_fields: Fields locked by GM
"""

# ============================================================================
# 3. NPC (Non-Player Character)
# ============================================================================
"""
NPC QUALITIES:

CORE IDENTITY:
- name: NPC's name
- level: NPC power level (GM-set)
- appearance: Physical description
- role: NPC's role in the story
- description: General description

CHARACTER DEVELOPMENT:
- weakness: NPC's weakness
- need: What the NPC needs
- desire: What the NPC desires
- rumour: Rumors about the NPC
- secret: NPC's secret
- passion: NPC's passion

STAND & ABILITIES:
- playbook: STAND, HAMON, or SPIN
- stand_name: Stand's name
- stand_description: Stand description
- stand_appearance: Stand appearance
- stand_manifestation: How Stand manifests
- special_traits: Special abilities
- custom_abilities: Custom ability descriptions
- stand_coin_stats: JSON with Stand stats

HERITAGE & RELATIONSHIPS:
- heritage: NPC's heritage/race
- relationships: JSON with relationship data

COMBAT & RESISTANCE:
- harm_clock_current: Current harm taken
- harm_clock_max: Maximum harm capacity (calculated from Durability)
- vulnerability_clock_current: Current vulnerability
- vulnerability_clock_max: Maximum vulnerability (calculated from Precision)
- regular_armor_charges: Regular armor charges (calculated from Durability)
- special_armor_charges: Special armor charges (calculated from Durability)

CAMPAIGN INTEGRATION:
- creator: GM who created the NPC
- campaign: Which campaign the NPC belongs to

ADDITIONAL FIELDS:
- purveyor: What the NPC provides
- notes: GM notes
- items: JSON list of items
- contacts: JSON list of contacts
- faction_status: JSON faction relationships
- inventory: JSON inventory list
"""

# ============================================================================
# 4. CAMPAIGN
# ============================================================================
"""
CAMPAIGN QUALITIES:

CORE IDENTITY:
- name: Campaign name
- description: Campaign description
- gm: Game Master running the campaign
- players: Players participating in the campaign

GAME STATE:
- wanted_stars: Campaign-wide wanted level (GM-controlled)
- active_session: Currently active session

RELATIONSHIPS:
- characters: Characters in the campaign
- npcs: NPCs in the campaign
- crews: Crews in the campaign
- factions: Factions in the campaign
- sessions: Sessions in the campaign
- progress_clocks: Campaign-level progress clocks
"""

# ============================================================================
# 5. SESSION
# ============================================================================
"""
SESSION QUALITIES:

CORE IDENTITY:
- name: Session title/name
- description: Session summary
- objective: Main goal for the session
- planned_for_next_session: Notes for next session
- status: PLANNED, ACTIVE, or COMPLETED

PARTICIPANTS:
- campaign: Which campaign this session belongs to
- characters_involved: Characters participating
- npcs_involved: NPCs involved
- factions_involved: Factions involved

SCORE PROPOSAL SYSTEM:
- proposed_score_target: Target for proposed score
- proposed_score_description: Description of proposed score
- proposed_by: Player who proposed the score
- votes: Players who voted for the score

TRACKING:
- session_date: When session was created
- events: Session events that occurred
- xp_entries: XP gained during session
- chat_messages: Chat messages during session
"""

# ============================================================================
# 6. CREW
# ============================================================================
"""
CREW QUALITIES:

CORE IDENTITY:
- name: Crew name
- description: Crew description
- campaign: Which campaign the crew belongs to
- playbook: Crew playbook type

ADVANCEMENT:
- level: Crew level (0+)
- xp: Current XP
- xp_track_size: XP track size (default 8)
- advancement_points: Advancement points earned

REPUTATION & STATUS:
- hold: weak or strong
- rep: Reputation level
- wanted_level: Wanted level
- coin: Current coin
- stash: Stashed coin

CLAIMS & UPGRADES:
- claims: Territory/claims owned
- upgrade_progress: Progress on upgrades (JSON)
- special_abilities: Special abilities

NAME CHANGE CONSENSUS:
- proposed_name: Proposed new name
- proposed_by: Player who proposed the name
- approved_by: Players who approved the name

RELATIONSHIPS:
- members: Characters in the crew
- faction_relationships: Relationships with factions
- progress_clocks: Crew-level progress clocks
"""

# ============================================================================
# 7. FACTION
# ============================================================================
"""
FACTION QUALITIES:

CORE IDENTITY:
- name: Faction name
- faction_type: CRIMINAL, NOBLE, MERCHANT, POLITICAL, RELIGIOUS, OTHER
- notes: GM notes about the faction
- campaign: Which campaign the faction belongs to

POWER & STATUS:
- level: Faction level (0+) - NEW FIELD ADDED
- hold: weak or strong
- reputation: Reputation value

RELATIONSHIPS:
- outgoing_relationships: Relationships with other factions
- incoming_relationships: Other factions' relationships with this one
- crew_relationships: Relationships with crews
- progress_clocks: Faction-level progress clocks
"""

# ============================================================================
# 8. STRESS SYSTEM
# ============================================================================
"""
STRESS QUALITIES:

BASE STRESS:
- Characters start with 8-13 stress based on Stand Durability:
  * S-rank Durability: 13 stress
  * A-rank Durability: 12 stress
  * B-rank Durability: 11 stress
  * C-rank Durability: 10 stress
  * D-rank Durability: 9 stress
  * F-rank Durability: 8 stress

STRESS GAIN:
- Taking harm
- Using certain abilities (stress_cost)
- Devil's bargains
- Desperate actions

STRESS RELIEF:
- Indulging vice
- Downtime activities
- Certain abilities

STRESS TRACKING:
- stress: Current stress level
- stress_history: History of stress changes
"""

# ============================================================================
# 9. ACTION RATINGS
# ============================================================================
"""
ACTION RATING QUALITIES:

ACTION CATEGORIES:
1. INSIGHT (Mental/Intellectual):
   - hunt: Finding things, tracking
   - study: Research, analysis
   - survey: Assessing situations
   - tinker: Crafting, fixing

2. PROWESS (Physical):
   - finesse: Precise movements
   - prowl: Stealth, sneaking
   - skirmish: Combat, fighting
   - wreck: Breaking things, force

3. RESOLVE (Social/Spiritual):
   - attune: Sensing supernatural
   - command: Leadership, authority
   - consort: Social interaction
   - sway: Persuasion, manipulation

RATING RULES:
- Level 1 characters: 7 total dots, max 2 per action
- Higher levels: Max 4 dots per action
- Attribute rating = number of actions with dots > 0
"""

# ============================================================================
# 10. ATTRIBUTE RATINGS
# ============================================================================
"""
ATTRIBUTE RATING QUALITIES:

CALCULATION:
- insight_attribute_rating: Number of insight actions with dots > 0
- prowess_attribute_rating: Number of prowess actions with dots > 0
- resolve_attribute_rating: Number of resolve actions with dots > 0

USAGE:
- Resistance rolls use attribute rating
- Certain abilities require minimum attribute ratings
- Advancement may require attribute ratings
"""

# ============================================================================
# 11. RESISTANCE & RESISTANCE ROLLS
# ============================================================================
"""
RESISTANCE QUALITIES:

RESISTANCE ROLLS:
- Use attribute rating (insight, prowess, or resolve)
- Roll attribute rating in dice
- Take highest result
- 6 = full resistance
- 4-5 = partial resistance
- 1-3 = no resistance

RESISTANCE TYPES:
- Insight resistance: Mental effects, illusions
- Prowess resistance: Physical effects, poison
- Resolve resistance: Social effects, fear
"""

# ============================================================================
# 12. ARMOR CHARGES
# ============================================================================
"""
ARMOR CHARGE QUALITIES:

ARMOR TYPES:
- light_armor_used: Light armor active
- medium_armor_used: Medium armor active
- heavy_armor_used: Heavy armor active

ARMOR CHARGES:
- regular_armor_charges: Regular armor charges (calculated from Durability)
- special_armor_charges: Special armor charges (calculated from Durability)

USAGE:
- Spend charges to reduce harm
- Different armor types provide different protection
- Charges are limited and must be managed
"""

# ============================================================================
# 13. TRAUMA
# ============================================================================
"""
TRAUMA QUALITIES:

TRAUMA CONDITIONS:
- trauma: List of trauma conditions
- Trauma conditions are permanent until healed
- Each trauma provides a mechanical effect
- Trauma can be gained from stress overflow

HEALING:
- healing_clock_segments: Total segments needed
- healing_clock_filled: Current progress
- Trauma heals through downtime activities
"""

# ============================================================================
# 14. HERITAGES
# ============================================================================
"""
HERITAGE QUALITIES:

CORE TRAITS:
- name: Heritage name (Human, Vampire, etc.)
- base_hp: Base hit points
- description: Heritage description

BENEFITS & DETRIMENTS:
- benefits: Available benefits (cost HP)
- detriments: Available detriments (provide HP)
- required: Some benefits/detriments are required
- hp_cost/hp_value: HP cost or value

HERITAGE POINTS:
- heritage_points_gained: Points gained from XP
- 5 XP per heritage point
- Used to purchase heritage abilities
"""

# ============================================================================
# 15. CLAIMS
# ============================================================================
"""
CLAIM QUALITIES:

CORE TRAITS:
- name: Claim name
- description: What the claim provides

USAGE:
- Claims are territory or resources
- Crews can own claims
- Claims provide mechanical benefits
- Claims can be contested between crews
"""

# ============================================================================
# 16. STAND COIN STATS
# ============================================================================
"""
STAND COIN STAT QUALITIES:

STATS:
- POWER: Physical strength and damage
- SPEED: Movement and reaction speed
- RANGE: Distance Stand can operate
- DURABILITY: How much damage Stand can take
- PRECISION: Accuracy and fine control
- DEVELOPMENT: Potential for growth

GRADES:
- S: Exceptional (5 points, GM permission required for PCs)
- A: Elite (4 points, grants 2 additional abilities)
- B: Skilled (3 points)
- C: Average (2 points)
- D: Below Average (1 point)
- F: Flawed (0 points)

POINT SYSTEM:
- Level 1 characters: Exactly 10 points total
- 10 XP per Stand coin point
- S-rank requires GM permission for player characters
"""

# ============================================================================
# 17. EXPERIENCE & ADVANCEMENT
# ============================================================================
"""
EXPERIENCE QUALITIES:

XP TYPES:
- xp_clocks: JSON field tracking different XP types
- XP gained from various triggers

ADVANCEMENT COSTS:
- Action dice: 5 XP per die
- Stand coin points: 10 XP per point
- Heritage points: 5 XP per point

LEVEL CALCULATION:
- level = 1 + (total_xp_spent // 10)
- Each level requires 10 XP total

TRACKING:
- total_xp_spent: Total XP spent on advancements
- heritage_points_gained: Heritage points from XP
- stand_coin_points_gained: Stand coin points from XP
- action_dice_gained: Action dice from XP
"""

# ============================================================================
# 18. PROGRESS CLOCKS
# ============================================================================
"""
PROGRESS CLOCK QUALITIES:

TYPES:
- PROJECT: Long-term projects
- HEALING: Healing clocks
- COUNTDOWN: Countdown timers
- CUSTOM: Custom clocks

PROPERTIES:
- max_segments: Total segments (4, 6, or 8)
- filled_segments: Current progress
- progress_percentage: Calculated progress
- completed: Whether clock is finished

ASSOCIATIONS:
- Can be linked to campaigns, crews, characters, or factions
- Track ongoing activities and projects
"""

# ============================================================================
# 19. DOWNTIME ACTIVITIES
# ============================================================================
"""
DOWNTIME ACTIVITY QUALITIES:

TYPES:
- ACQUIRE_ASSET: Get new equipment
- LONG_TERM_PROJECT: Work on projects
- RECOVER: Heal stress and harm
- REDUCE_HEAT: Lower wanted level
- TRAIN: Improve abilities
- INDULGE_VICE: Relieve stress
- REDUCE_WANTED_LEVEL: Lower wanted level

EFFECTS:
- stress_relieved: Stress reduced
- harm_healed: Harm healed
- progress_made: Progress on clocks
"""

# ============================================================================
# 20. SCORES (JOBS/MISSIONS)
# ============================================================================
"""
SCORE QUALITIES:

TYPES:
- ASSAULT: Direct confrontation
- DECEPTION: Trickery and lies
- STEALTH: Sneaking and infiltration
- OCCULT: Supernatural activities
- SOCIAL: Social manipulation
- TRANSPORT: Moving goods/people

REWARDS:
- rep_gained: Reputation gained
- coin_gained: Money earned
- heat_gained: Heat/wanted level gained

TRACKING:
- target: What/who is the target
- participants: Characters involved
- completed: Whether score is finished
- success_level: How well it went
- consequences: Complications that arose
"""

print("Game entities overview created successfully!")
print("This document provides a comprehensive breakdown of all game mechanics and entities.") 