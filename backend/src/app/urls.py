# backend/src/urls.py - Fix

from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from characters.views import (
    HeritageViewSet, ViceViewSet, AbilityViewSet,
    StandViewSet, CharacterViewSet,
    CampaignViewSet, NPCViewSet, CrewViewSet,
    TraumaViewSet,
    home, RegisterView, StandAbilityViewSet, LoginView,
    HamonAbilityViewSet, SpinAbilityViewSet, global_search,
    get_available_playbook_abilities, api_documentation,
)


router = routers.DefaultRouter()
router.register(r'heritages', HeritageViewSet)
router.register(r'vices', ViceViewSet)
router.register(r'abilities', AbilityViewSet)
router.register(r'stands', StandViewSet)
router.register(r'stand-abilities', StandAbilityViewSet)
router.register(r'hamon-abilities', HamonAbilityViewSet)
router.register(r'spin-abilities', SpinAbilityViewSet)
router.register(r'characters', CharacterViewSet, basename='characters')
router.register(r'campaigns', CampaignViewSet)
router.register(r'npcs', NPCViewSet)
router.register(r'crews', CrewViewSet)
router.register(r'traumas', TraumaViewSet)


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
]