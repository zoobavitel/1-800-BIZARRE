from django.urls import path, include
from rest_framework import routers
from .views import RegisterView, LoginView, UserProfileViewSet

router = routers.DefaultRouter()
router.register(r'user-profiles', UserProfileViewSet, basename='user-profiles')

urlpatterns = [
    path('signup/', RegisterView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('', include(router.urls)),
]