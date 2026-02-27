"""
Stand types and example builds from the 1(800)Bizarre SRD.
Used by the character creation guide API.
"""

STAND_TYPES = [
    {'id': 'automatic', 'name': 'Automatic', 'description': 'Acts based on a trigger, often with autonomous logic'},
    {'id': 'tool-bound', 'name': 'Tool-Bound', 'description': 'Bound to an object or medium'},
    {'id': 'fighting', 'name': 'Fighting Spirit', 'description': 'Humanoid, close-range or long-range combatant'},
    {'id': 'phenomena', 'name': 'Phenomena', 'description': 'Abstract, bizarre, and surreal'},
    {'id': 'shared', 'name': 'Shared', 'description': 'Split across multiple users or locations'},
    {'id': 'colony', 'name': 'Colony', 'description': 'Composed of tens to hundreds of linked entities'},
]

STAND_EXAMPLE_BUILDS = [
    {
        'name': '3 Little Birds',
        'type': 'Colony',
        'summary': 'A swarm of three intelligent birds—each with a unique function. As they fall, the remaining ones cannibalize their powers, growing stronger but more vulnerable.',
        'stand_coin': {
            'power': 'D',
            'speed': 'D',
            'range': 'C',
            'durability': 'D',
            'precision': 'D',
            'development': 'F',
        },
        'unique_abilities': [
            'Cannibal Chain – When one bird is defeated or eaten by another bird, it may absorb its ability as a temporary second function.',
            'Bird 1 can spit acid and gain +1 armor underground, Bird 2 can spit blinding ink and gain +1 armor underwater, bird 3 gains armor while flying.',
            'Tri-Will Split – You may issue separate commands to each bird (max 3 targets), but reduce effect by 1 for each split action.',
        ],
        'recommended_standard_abilities': [
            'Shared Vision – See through your Stand\'s eyes; critical for multi-angle surveillance.',
            'Cascade Effect – The swarm\'s reactive nature fits well with counter-punishment.',
            'Reflexes – A must for keeping up when managing three simultaneous moves.',
        ],
    },
    {
        'name': 'Paint It Black',
        'type': 'Automatic',
        'summary': 'A skeleton that hunts hostile heat signatures and leaves corrosive ink behind. It\'s fast to burn, slow to return.',
        'stand_coin': {
            'power': 'B',
            'speed': 'F',
            'range': 'D',
            'durability': 'D',
            'precision': 'F',
            'development': 'D',
        },
        'unique_abilities': [
            'Meltdown Pulse – When striking a heat source, melt through armor or terrain as if it were soft.',
            'Ink Drift – After an explosive action, terrain becomes toxic. Movement through the zone costs 1 stress or requires resistance.',
        ],
        'recommended_standard_abilities': [
            'Saboteur – Perfect synergy with the ink hazard lingering after actions.',
            'Autonomous Detonation – A thematic match; could represent the ink triggering a delayed blast.',
            'Superhero Landing – When Paint explodes beneath you, recover with flare.',
        ],
    },
    {
        'name': 'Nitro Burnin\' Funny Car',
        'type': 'Tool-Bound',
        'summary': 'A hot rod engine bound to your soul. Whenever you touch machinery, you supercharge it—until it burns out.',
        'stand_coin': {
            'power': 'D',
            'speed': 'C',
            'range': 'D',
            'durability': 'D',
            'precision': 'F',
            'development': 'D',
        },
        'unique_abilities': [
            'Overdrive – When the user interacts with machinery, you are able to extend the stand coin properties to that machine.',
            'Autokill Directive – Once per score, name a kill condition (e.g. "when it flees," "when it draws a weapon"). When fulfilled, the Stand auto-triggers an attack, maneuver, or other action.',
        ],
        'recommended_standard_abilities': [
            'Trap Sequence – Stack this with Autokill for paranoid, preloaded lethality.',
            'Echo Strikes – Makes your tool-shocks feel fast and reactive.',
            'Bizarre Ward – A mechanic-tuned Wreck can become a supernatural reinforcement.',
        ],
    },
    {
        'name': 'Lethal Injection',
        'type': 'Fighting Spirit',
        'summary': 'A humanoid Stand cloaked in elemental fire and ice. It swaps temperature states mid-combat to disable enemies in creative ways.',
        'stand_coin': {
            'power': 'D',
            'speed': 'D',
            'range': 'D',
            'durability': 'D',
            'precision': 'D',
            'development': 'D',
        },
        'unique_abilities': [
            'Thermic Chain – Each attack shifts element. Fire causes lingering burn (half POWER), ice creates "brittle" status (next hit +1 Harm).',
            'Blister Swap – Once per scene, swap places with your Stand during a resistance roll to ignore 1 level of harm.',
        ],
        'recommended_standard_abilities': [
            'Iron Will – You\'ll often take the front line. Stay standing.',
            'Spin-Boosted Blow – Perfect for dual-elemental finishers.',
            'Final Barrage – Justified dramatically by fire/ice overload.',
        ],
    },
    {
        'name': 'Dream Baby Dream',
        'type': 'Phenomena',
        'summary': 'Your Stand is a shared hallucination—a child\'s recurring nightmare with metaphysical weight. Nothing is real until it is… or isn\'t.',
        'stand_coin': {
            'power': 'F',
            'speed': 'F',
            'range': 'C',
            'durability': 'F',
            'precision': 'F',
            'development': 'A',
        },
        'unique_abilities': [
            'Narrative Override – Once per score, describe how a "strange coincidence" saves you from a failed roll.',
            'Emotion Veil – Project an emotional field. If targets fail to resist, they suffer -1d on their next action due to overwhelming effect.',
        ],
        'recommended_standard_abilities': [
            'Undo Truth – Fiction-bending logic pairs naturally with this dream-state Stand.',
            'Bizarre Improvisation – This is your default mode. Make it unpredictable.',
            'Like Looking into a Mirror – Hallucinatory logic creates hard-to-lie zones.',
        ],
    },
    {
        'name': 'Home is Where the Hatred is',
        'type': 'Shared',
        'summary': 'Your stand is capable of regenerating your limbs, organs, and any of your organic matter. This feature is shared amongst those you choose.',
        'stand_coin': {
            'power': 'F',
            'speed': 'F',
            'range': 'D',
            'durability': 'A',
            'precision': 'D',
            'development': 'F',
        },
        'unique_abilities': [
            'iii: The stand is capable of regenerating the user\'s limbs at an alarmingly rapid rate.',
            'Copycat: You can create sentient clones; you may share this stand amongst sentient clones of yourself.',
        ],
        'recommended_standard_abilities': [
            'Cascade Effect: If you roll a 6 from your resistance roll to resist a physical or bizarre consequence, the attacker suffers a mirrored backlash.',
            'Bizarre Step: Push (2 stress) to instantly reposition within your stand\'s range. Nearby observers must resist or lose track of you.',
            'The Devil\'s Footsteps: When you push yourself, choose one of the following additional benefits: Perform a feat of athletics that verges past superhuman for 1 scene, or maneuver to confuse your enemies so they mistakenly attack each other.',
        ],
    },
]
