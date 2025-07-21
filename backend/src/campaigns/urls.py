from django.urls import path, include
from rest_framework import routers
from .views import CampaignViewSet, SessionViewSet, ChatMessageViewSet

router = routers.DefaultRouter()
router.register(r'', CampaignViewSet)
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'chat-messages', ChatMessageViewSet, basename='chat-message')

urlpatterns = [
    path('', include(router.urls)),
]
