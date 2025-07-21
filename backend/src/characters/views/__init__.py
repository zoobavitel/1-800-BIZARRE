# Import all view classes for backward compatibility
from .character_views import CharacterViewSet
from .campaign_views import CampaignViewSet
from .npc_views import NPCViewSet
from .crew_views import CrewViewSet
from .session_views import SessionViewSet, SessionEventViewSet
from .auth_views import RegisterView, LoginView, UserProfileViewSet
from .gameplay_views import (
    ClaimViewSet, CrewSpecialAbilityViewSet, CrewPlaybookViewSet,
    CrewUpgradeViewSet, XPHistoryViewSet, StressHistoryViewSet,
    ChatMessageViewSet
)
from .reference_views import (
    HeritageViewSet, ViceViewSet, AbilityViewSet, StandViewSet,
    StandAbilityViewSet, HamonAbilityViewSet, SpinAbilityViewSet,
    TraumaViewSet, CharacterHistoryViewSet, ExperienceTrackerViewSet
)
from .utility_views import (
    global_search, get_available_playbook_abilities, 
    api_documentation, home, SpendCoinAPIView
)

__all__ = [
    'CharacterViewSet', 'CampaignViewSet', 'NPCViewSet', 'CrewViewSet',
    'SessionViewSet', 'SessionEventViewSet', 'RegisterView', 'LoginView',
    'UserProfileViewSet', 'ClaimViewSet', 'CrewSpecialAbilityViewSet',
    'CrewPlaybookViewSet', 'CrewUpgradeViewSet', 'XPHistoryViewSet',
    'StressHistoryViewSet', 'ChatMessageViewSet', 'HeritageViewSet',
    'ViceViewSet', 'AbilityViewSet', 'StandViewSet', 'StandAbilityViewSet',
    'HamonAbilityViewSet', 'SpinAbilityViewSet', 'TraumaViewSet',
    'CharacterHistoryViewSet', 'ExperienceTrackerViewSet',
    'global_search', 'get_available_playbook_abilities', 'api_documentation',
    'home', 'SpendCoinAPIView'
] 