# backend/src/urls.py - Fix

from django.contrib import admin
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework_nested import routers as nested_routers
from django.conf import settings
from django.conf.urls.static import static
from characters.views import (
    UserProfileViewSet, HeritageViewSet, ViceViewSet, AbilityViewSet,
    StandViewSet, CharacterViewSet,
    CampaignViewSet, CampaignInvitationViewSet, ShowcasedNPCViewSet,
    FactionViewSet, NPCViewSet, CrewViewSet,
    TraumaViewSet, CharacterHistoryViewSet, ExperienceTrackerViewSet, SessionViewSet, SessionEventViewSet,
    RollViewSet,
    home, RegisterView, StandAbilityViewSet, LoginView, CurrentUserView,
    HamonAbilityViewSet, SpinAbilityViewSet, global_search,
    get_available_playbook_abilities, api_documentation,
    XPHistoryViewSet, StressHistoryViewSet, ChatMessageViewSet,
    ClaimViewSet, CrewPlaybookViewSet, CrewSpecialAbilityViewSet, CrewUpgradeViewSet,
    ProgressClockViewSet
)


router = routers.DefaultRouter()
router.register(r'user-profiles', UserProfileViewSet, basename='user-profiles')
router.register(r'heritages', HeritageViewSet)
router.register(r'vices', ViceViewSet)
router.register(r'abilities', AbilityViewSet)
router.register(r'stands', StandViewSet)
router.register(r'stand-abilities', StandAbilityViewSet)
router.register(r'hamon-abilities', HamonAbilityViewSet)
router.register(r'spin-abilities', SpinAbilityViewSet)
router.register(r'characters', CharacterViewSet, basename='characters')
router.register(r'character-history', CharacterHistoryViewSet, basename='character-history')
router.register(r'experience-tracker', ExperienceTrackerViewSet, basename='experience-tracker')
router.register(r'sessions', SessionViewSet, basename='sessions')
router.register(r'session-events', SessionEventViewSet)
router.register(r'rolls', RollViewSet, basename='rolls')
router.register(r'campaigns', CampaignViewSet)
router.register(r'campaign-invitations', CampaignInvitationViewSet, basename='campaign-invitations')
router.register(r'showcased-npcs', ShowcasedNPCViewSet, basename='showcased-npcs')
router.register(r'progress-clocks', ProgressClockViewSet, basename='progress-clocks')
router.register(r'factions', FactionViewSet)
router.register(r'npcs', NPCViewSet)
router.register(r'crews', CrewViewSet)
router.register(r'traumas', TraumaViewSet)
router.register(r'xp-history', XPHistoryViewSet)
router.register(r'stress-history', StressHistoryViewSet)
router.register(r'chat-messages', ChatMessageViewSet)
router.register(r'claims', ClaimViewSet)
router.register(r'crew-playbooks', CrewPlaybookViewSet)
router.register(r'crew-special-abilities', CrewSpecialAbilityViewSet)
router.register(r'crew-upgrades', CrewUpgradeViewSet)






urlpatterns = [
    path('', home),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/search/', global_search, name='global_search'),
    path('api/get_available_playbook_abilities/', get_available_playbook_abilities, name='get_available_playbook_abilities'),
    path('api/docs/', api_documentation, name='api_documentation'),
    # Use your custom LoginView instead of obtain_auth_token
    path('api/accounts/login/', LoginView.as_view(), name='login'),
    path('api/accounts/signup/', RegisterView.as_view(), name='signup'),
    path('api/accounts/me/', CurrentUserView.as_view(), name='current_user'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
