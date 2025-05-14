from django.shortcuts import render
from django.http import JsonResponse
from django.db import models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import RegisterSerializer
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from django.contrib.auth import authenticate
from rest_framework.permissions import AllowAny



from .models import (
    Heritage, Vice, Ability, Character, Stand,
    Campaign, NPC, Crew, StandAbility
)
from .serializers import (
    HeritageSerializer, ViceSerializer, AbilitySerializer,
    CharacterSerializer, StandSerializer,
    CampaignSerializer, NPCSerializer, CrewSerializer, StandAbilitySerializer
)

# Optional root view
def home(request):
    return JsonResponse({"message": "Welcome to the 1(800)Bizarre API!"})

class RegisterView(APIView):
    permission_classes = [AllowAny]  # <-- ADD THIS LINE

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({'token': token.key}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# === ViewSets ===

class HeritageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Heritage.objects.all()
    serializer_class = HeritageSerializer


class ViceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Vice.objects.all()
    serializer_class = ViceSerializer


class AbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Ability.objects.all()
    serializer_class = AbilitySerializer

class StandViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Stand.objects.all()
    serializer_class = StandSerializer

class StandAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StandAbility.objects.all()
    serializer_class = StandAbilitySerializer

class CharacterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CharacterSerializer
    queryset = Character.objects.all()  # ✅ Add this line

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Character.objects.all()
        elif Campaign.objects.filter(gm=user).exists():
            return Character.objects.filter(campaign__gm=user)
        return Character.objects.filter(user=user)


    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer

    def get_queryset(self):
        user = self.request.user
        return Campaign.objects.filter(models.Q(gm=user) | models.Q(players=user)).distinct()


class NPCViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = NPC.objects.all()
    serializer_class = NPCSerializer

    def get_queryset(self):
        user = self.request.user
        return NPC.objects.filter(campaign__gm=user)


class CrewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Crew.objects.all()
    serializer_class = CrewSerializer

    def get_queryset(self):
        user = self.request.user
        return Crew.objects.filter(campaign__gm=user)  # Only GMs see crew by default

class LoginView(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username
            }
        })


# === Custom API View ===

class SpendCoinAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            character = Character.objects.get(pk=pk)
        except Character.DoesNotExist:
            return Response({"error": "Character not found"}, status=404)

        crew = character.crew
        if not crew:
            return Response({"error": "Character has no crew"}, status=400)

        try:
            cost = int(request.data.get("cost", 0))
        except ValueError:
            return Response({"error": "Invalid coin amount"}, status=400)

        if cost > crew.coin:
            return Response({"error": "Not enough coin"}, status=400)

        crew.coin -= cost
        crew.save()
        return Response({"message": f"Spent {cost} coin from crew '{crew.name}'"}, status=200)
