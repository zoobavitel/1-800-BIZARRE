import logging

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.authtoken.views import ObtainAuthToken
from knox.models import AuthToken
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from ..models import UserProfile
from ..serializers import (
    RegisterSerializer, UserProfileSerializer,
    UserSerializer, ChangePasswordSerializer,
)

logger = logging.getLogger(__name__)


def _signup_user_message(errors: dict) -> str:
    """Short user-facing summary for failed signup (field details remain in body)."""
    u = errors.get('username')
    if isinstance(u, list) and u:
        text = str(u[0]).lower()
        if 'taken' in text or 'already' in text:
            return str(u[0])
    p = errors.get('password')
    if isinstance(p, list) and p:
        return f"Password: {p[0]}"
    return 'Could not create this account. Check username and password, then try again.'


def _login_response_body(user):
    """New login token for this device, plus the user.

    Each sign-in gets its own token (knox), so signing out on one device
    leaves the others signed in. The token expires 30 days after its last use
    (see REST_KNOX in settings).
    """
    instance, token = AuthToken.objects.create(user)
    return {
        'token': token,
        'expiry': instance.expiry.isoformat() if instance.expiry else None,
        'user': {
            'id': user.pk,
            'username': user.username,
            'email': getattr(user, 'email', '') or '',
        },
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]
    # A stale token sent along must not block signing up.
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                _login_response_body(user), status=status.HTTP_201_CREATED
            )
        body = dict(serializer.errors)
        body['message'] = _signup_user_message(body)
        return Response(body, status=status.HTTP_400_BAD_REQUEST)


class LoginView(ObtainAuthToken):
    # The browser may still send an expired token; it must not block a new
    # sign-in with a password.
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data,
            context={'request': request},
        )
        if serializer.is_valid():
            user = serializer.validated_data['user']
            ip = request.META.get('REMOTE_ADDR', '?')
            logger.info("Login successful: user=%s ip=%s", user.username, ip)
            return Response(_login_response_body(user))
        body = dict(serializer.errors)
        body['message'] = (
            'Invalid username or password. Check your credentials and try again.'
        )
        return Response(body, status=status.HTTP_400_BAD_REQUEST)


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
    parser_classes = (JSONParser, MultiPartParser, FormParser)

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
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'user': request.user},
        )
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Password updated successfully'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST) 