from django.shortcuts import render
from django.http import JsonResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q

from ..models import (
    Character, Campaign, NPC, Crew, Heritage, Vice, Ability,
    StandAbility, HamonAbility, SpinAbility
)


# Optional root view
def home(request):
    return JsonResponse({"message": "Welcome to the 1(800)Bizarre API!"})


class SpendCoinAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Spend coin from a character's stash."""
        try:
            character = Character.objects.get(pk=pk, user=request.user)
            amount = request.data.get('amount', 0)
            
            if amount <= 0:
                return Response(
                    {'error': 'Amount must be positive'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if character.coin < amount:
                return Response(
                    {'error': 'Insufficient coin'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            character.coin -= amount
            character.save()
            
            return Response({
                'message': f'Spent {amount} coin',
                'coin_spent': amount,
                'remaining_coin': character.coin
            })
        except Character.DoesNotExist:
            return Response(
                {'error': 'Character not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """Global search across all game entities."""
    query = request.GET.get('q', '')
    if not query:
        return Response({'error': 'Query parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    results = {
        'characters': [],
        'campaigns': [],
        'npcs': [],
        'crews': [],
        'heritages': [],
        'vices': [],
        'abilities': []
    }
    
    # Search characters
    if user.is_staff:
        characters = Character.objects.filter(name__icontains=query)
    else:
        characters = Character.objects.filter(
            Q(name__icontains=query) & Q(user=user)
        )
    results['characters'] = [
        {'id': c.id, 'name': c.name, 'type': 'character'} 
        for c in characters[:10]
    ]
    
    # Search campaigns
    if user.is_staff:
        campaigns = Campaign.objects.filter(name__icontains=query)
    else:
        campaigns = Campaign.objects.filter(
            Q(name__icontains=query) & 
            (Q(gm=user) | Q(characters__user=user))
        ).distinct()
    results['campaigns'] = [
        {'id': c.id, 'name': c.name, 'type': 'campaign'} 
        for c in campaigns[:10]
    ]
    
    # Search NPCs
    if user.is_staff:
        npcs = NPC.objects.filter(name__icontains=query)
    else:
        npcs = NPC.objects.filter(
            Q(name__icontains=query) & Q(campaign__gm=user)
        )
    results['npcs'] = [
        {'id': n.id, 'name': n.name, 'type': 'npc'} 
        for n in npcs[:10]
    ]
    
    # Search crews
    if user.is_staff:
        crews = Crew.objects.filter(name__icontains=query)
    else:
        crews = Crew.objects.filter(
            Q(name__icontains=query) & 
            (Q(campaign__gm=user) | Q(campaign__characters__user=user))
        ).distinct()
    results['crews'] = [
        {'id': c.id, 'name': c.name, 'type': 'crew'} 
        for c in crews[:10]
    ]
    
    # Search reference data
    heritages = Heritage.objects.filter(name__icontains=query)
    results['heritages'] = [
        {'id': h.id, 'name': h.name, 'type': 'heritage'} 
        for h in heritages[:10]
    ]
    
    vices = Vice.objects.filter(name__icontains=query)
    results['vices'] = [
        {'id': v.id, 'name': v.name, 'type': 'vice'} 
        for v in vices[:10]
    ]
    
    abilities = Ability.objects.filter(name__icontains=query)
    results['abilities'] = [
        {'id': a.id, 'name': a.name, 'type': 'ability'} 
        for a in abilities[:10]
    ]
    
    return Response(results)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_available_playbook_abilities(request):
    """Get available abilities for character playbooks."""
    heritage_id = request.GET.get('heritage_id')
    if not heritage_id:
        return Response(
            {'error': 'Heritage ID is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        heritage = Heritage.objects.get(id=heritage_id)
    except Heritage.DoesNotExist:
        return Response(
            {'error': 'Heritage not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    abilities = {
        'stand_abilities': [],
        'hamon_abilities': [],
        'spin_abilities': []
    }
    
    # Get abilities based on heritage type
    if heritage.name.lower() == 'stand user':
        stand_abilities = StandAbility.objects.all()
        abilities['stand_abilities'] = [
            {
                'id': sa.id,
                'name': sa.name,
                'description': sa.description,
                'cost': sa.cost
            }
            for sa in stand_abilities
        ]
    elif heritage.name.lower() == 'hamon user':
        hamon_abilities = HamonAbility.objects.all()
        abilities['hamon_abilities'] = [
            {
                'id': ha.id,
                'name': ha.name,
                'description': ha.description,
                'cost': ha.cost
            }
            for ha in hamon_abilities
        ]
    elif heritage.name.lower() == 'spin user':
        spin_abilities = SpinAbility.objects.all()
        abilities['spin_abilities'] = [
            {
                'id': spa.id,
                'name': spa.name,
                'description': spa.description,
                'cost': spa.cost
            }
            for spa in spin_abilities
        ]
    
    return Response(abilities)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_documentation(request):
    """Return API documentation and available endpoints."""
    documentation = {
        'title': '1(800)Bizarre API',
        'version': '1.0.0',
        'description': 'API for the 1-800-BIZARRE Platform',
        'endpoints': {
            'authentication': {
                'register': 'POST /api/auth/register/',
                'login': 'POST /api/auth/login/',
                'logout': 'POST /api/auth/logout/',
            },
            'characters': {
                'list': 'GET /api/characters/',
                'create': 'POST /api/characters/',
                'detail': 'GET /api/characters/{id}/',
                'update': 'PUT /api/characters/{id}/',
                'delete': 'DELETE /api/characters/{id}/',
                'roll_action': 'POST /api/characters/{id}/roll-action/',
                'indulge_vice': 'POST /api/characters/{id}/indulge-vice/',
                'take_harm': 'POST /api/characters/{id}/take-harm/',
                'heal_harm': 'POST /api/characters/{id}/heal-harm/',
                'add_xp': 'POST /api/characters/{id}/add-xp/',
            },
            'campaigns': {
                'list': 'GET /api/campaigns/',
                'create': 'POST /api/campaigns/',
                'detail': 'GET /api/campaigns/{id}/',
                'update': 'PUT /api/campaigns/{id}/',
                'delete': 'DELETE /api/campaigns/{id}/',
            },
            'crews': {
                'list': 'GET /api/crews/',
                'create': 'POST /api/crews/',
                'detail': 'GET /api/crews/{id}/',
                'update': 'PUT /api/crews/{id}/',
                'delete': 'DELETE /api/crews/{id}/',
                'propose_name': 'POST /api/crews/{id}/propose-name/',
                'approve_name': 'POST /api/crews/{id}/approve-name/',
            },
            'sessions': {
                'list': 'GET /api/sessions/',
                'create': 'POST /api/sessions/',
                'detail': 'GET /api/sessions/{id}/',
                'update': 'PUT /api/sessions/{id}/',
                'delete': 'DELETE /api/sessions/{id}/',
                'propose_score': 'POST /api/sessions/{id}/propose-score/',
                'vote_for_score': 'POST /api/sessions/{id}/vote-for-score/',
            },
            'reference': {
                'heritages': 'GET /api/heritages/',
                'vices': 'GET /api/vices/',
                'abilities': 'GET /api/abilities/',
                'stand_abilities': 'GET /api/stand-abilities/',
                'hamon_abilities': 'GET /api/hamon-abilities/',
                'spin_abilities': 'GET /api/spin-abilities/',
                'traumas': 'GET /api/traumas/',
            },
            'utility': {
                'search': 'GET /api/search/?q={query}',
                'playbook_abilities': 'GET /api/playbook-abilities/?heritage_id={id}',
                'spend_coin': 'POST /api/characters/{id}/spend-coin/',
            }
        },
        'authentication': {
            'type': 'Token Authentication',
            'header': 'Authorization: Token {your_token}',
        }
    }
    
    return Response(documentation) 