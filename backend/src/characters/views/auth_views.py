import json
import logging
import time

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth import authenticate

from ..models import UserProfile
from ..serializers import (
    RegisterSerializer, UserProfileSerializer,
    UserSerializer, ChangePasswordSerializer,
)

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': {
                    'id': user.pk,
                    'username': user.username,
                    'email': getattr(user, 'email', '') or '',
                },
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        # #region agent log
        _data = getattr(request, "data", {}) or {}
        _keys = list(_data.keys()) if hasattr(_data, "keys") else []
        _uname = _data.get("username", "")
        _pwd = _data.get("password", "")
        try:
            with open(
                "/home/z/git/jojo-ttrpg-platform/.cursor/debug-dbd452.log", "a"
            ) as _df:
                _df.write(
                    json.dumps(
                        {
                            "sessionId": "dbd452",
                            "timestamp": int(time.time() * 1000),
                            "location": "auth_views.py:LoginView.post",
                            "message": "login_request",
                            "hypothesisId": "H2-H3",
                            "data": {
                                "content_type": request.META.get("CONTENT_TYPE", ""),
                                "data_keys": _keys,
                                "username_len": len(str(_uname)),
                                "password_len": len(str(_pwd)) if _pwd is not None else 0,
                            },
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        serializer = self.serializer_class(data=request.data,
                                         context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token, created = Token.objects.get_or_create(user=user)
            ip = request.META.get('REMOTE_ADDR', '?')
            logger.info("Login successful: user=%s ip=%s", user.username, ip)
            return Response({
                'token': token.key,
                'user': {
                    'id': user.pk,
                    'username': user.username,
                    'email': getattr(user, 'email', '') or '',
                },
            })
        # #region agent log
        try:
            with open(
                "/home/z/git/jojo-ttrpg-platform/.cursor/debug-dbd452.log", "a"
            ) as _df:
                _df.write(
                    json.dumps(
                        {
                            "sessionId": "dbd452",
                            "timestamp": int(time.time() * 1000),
                            "location": "auth_views.py:LoginView.post",
                            "message": "login_serializer_invalid",
                            "hypothesisId": "H1-H4",
                            "data": {"errors": serializer.errors},
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # #endregion
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """Return the current authenticated user (for token validation and display)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.pk,
            'username': user.username,
            'email': getattr(user, 'email', '') or '',
        })


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can only see their own profile
        return UserProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['put'], url_path='update')
    def update_profile(self, request):
        """Update the current user's profile."""
        try:
            profile = UserProfile.objects.get(user=request.user)
            serializer = UserProfileSerializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        """Change the current user's password."""
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if user.check_password(serializer.data.get('old_password')):
                user.set_password(serializer.data.get('new_password'))
                user.save()
                return Response({'message': 'Password updated successfully'})
            return Response(
                {'error': 'Incorrect old password'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 