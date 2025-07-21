from rest_framework.routers import DefaultRouter
from .views import FactionViewSet, FactionRelationshipViewSet, CrewFactionRelationshipViewSet

router = DefaultRouter()
router.register(r'factions', FactionViewSet)
router.register(r'faction-relationships', FactionRelationshipViewSet)
router.register(r'crew-faction-relationships', CrewFactionRelationshipViewSet)

urlpatterns = router.urls