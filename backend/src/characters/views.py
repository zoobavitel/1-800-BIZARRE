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
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes



from .models import (
    Heritage, Vice, Ability, Character, Stand,
    Campaign, NPC, Crew, StandAbility, HamonAbility, SpinAbility
)
from .serializers import (
    HeritageSerializer, ViceSerializer, AbilitySerializer,
    CharacterSerializer, StandSerializer,
    CampaignSerializer, NPCSerializer, CrewSerializer, StandAbilitySerializer,
    HamonAbilitySerializer, SpinAbilitySerializer
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

class HamonAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = HamonAbility.objects.all()
    serializer_class = HamonAbilitySerializer

class SpinAbilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SpinAbility.objects.all()
    serializer_class = SpinAbilitySerializer

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

    def perform_create(self, serializer):
        # Automatically set the current user as the GM
        serializer.save(gm=self.request.user)


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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """
    Global search endpoint that searches across characters, campaigns, NPCs, abilities, and heritages
    """
    query = request.GET.get('q', '').strip()
    
    if not query:
        return Response({
            'results': [],
            'message': 'No search query provided'
        })
    
    user = request.user
    results = []
    
    # Search Characters
    character_queryset = Character.objects.filter(
        Q(user=user) | Q(campaign__gm=user)
    ).filter(
        Q(true_name__icontains=query) |
        Q(alias__icontains=query) |
        Q(stand_name__icontains=query) |
        Q(background_note__icontains=query) |
        Q(heritage__name__icontains=query)
    )[:10]
    
    for char in character_queryset:
        results.append({
            'type': 'character',
            'id': char.id,
            'title': char.true_name or 'Unnamed Character',
            'subtitle': f"{char.heritage.name if char.heritage else 'Human'} • {char.playbook or 'STAND'} User",
            'description': f"Stand: {char.stand_name or 'Unnamed Stand'}",
            'url': f'/characters/{char.id}',
            'campaign': char.campaign.name if char.campaign else None
        })
    
    # Search Campaigns
    campaign_queryset = Campaign.objects.filter(
        Q(gm=user) | Q(players=user)
    ).filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    ).distinct()[:10]
    
    for campaign in campaign_queryset:
        results.append({
            'type': 'campaign',
            'id': campaign.id,
            'title': campaign.name,
            'subtitle': f"Campaign • GM: {campaign.gm.username}",
            'description': campaign.description or 'No description',
            'url': f'/campaigns',
            'campaign': campaign.name
        })
    
    # Search NPCs (only if user is GM)
    npc_queryset = NPC.objects.filter(
        campaign__gm=user
    ).filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]
    
    for npc in npc_queryset:
        results.append({
            'type': 'npc',
            'id': npc.id,
            'title': npc.name,
            'subtitle': f"NPC • {npc.campaign.name}",
            'description': npc.description or 'No description',
            'url': f'/campaigns',
            'campaign': npc.campaign.name
        })
    
    # Search Abilities
    ability_queryset = Ability.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]
    
    for ability in ability_queryset:
        results.append({
            'type': 'ability',
            'id': ability.id,
            'title': ability.name,
            'subtitle': f"Ability • {ability.type.title()}",
            'description': ability.description[:100] + '...' if len(ability.description) > 100 else ability.description,
            'url': f'/rules#abilities',
            'campaign': None
        })
    
    # Search Heritages
    heritage_queryset = Heritage.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]
    
    for heritage in heritage_queryset:
        results.append({
            'type': 'heritage',
            'id': heritage.id,
            'title': heritage.name,
            'subtitle': f"Heritage • Base HP: {heritage.base_hp}",
            'description': heritage.description or 'No description',
            'url': f'/rules#heritages',
            'campaign': None
        })
    
    return Response({
        'results': results,
        'total': len(results),
        'query': query
    })
