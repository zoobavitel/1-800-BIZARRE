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
from .character_views import _character_queryset_for_user


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
    """Global search across characters, campaigns, NPCs, abilities, heritages, Hamon/Spin/Stand abilities."""
    query = request.GET.get('q', '').strip()
    if not query:
        return Response({'results': [], 'message': 'No search query provided'})

    user = request.user
    results = []

    # Search Characters (use true_name, not name) — same visibility as CharacterViewSet detail
    character_queryset = _character_queryset_for_user(user).filter(
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
            'title': campaign.name or 'Unnamed',
            'subtitle': f"Campaign • GM: {campaign.gm.username if campaign.gm else '—'}",
            'description': campaign.description or 'No description',
            'url': f'/campaigns',
            'campaign': campaign.name
        })

    # Search NPCs (only if user is GM)
    npc_queryset = NPC.objects.filter(campaign__gm=user).filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]

    for npc in npc_queryset:
        results.append({
            'type': 'npc',
            'id': npc.id,
            'title': npc.name or 'Unnamed',
            'subtitle': f"NPC • {npc.campaign.name if npc.campaign else '—'}",
            'description': npc.description or 'No description',
            'url': f'/campaigns',
            'campaign': npc.campaign.name if npc.campaign else None
        })

    # Search Standard Abilities (Ability model)
    ability_queryset = Ability.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]

    for ability in ability_queryset:
        desc = ability.description or ''
        try:
            cat_label = ability.get_category_display()
        except (AttributeError, ValueError):
            cat_label = getattr(ability, 'category', '') or 'Standard'
        results.append({
            'type': 'ability',
            'id': ability.id,
            'title': ability.name or 'Unnamed',
            'subtitle': f"Standard Ability • {cat_label}",
            'description': desc[:100] + '...' if len(desc) > 100 else desc,
            'url': f'/abilities-ability',
            'campaign': None
        })

    # Search Hamon Abilities (playbook)
    hamon_queryset = HamonAbility.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]

    for ha in hamon_queryset:
        desc = ha.description or ''
        try:
            type_label = ha.get_hamon_type_display()
        except (AttributeError, ValueError):
            type_label = getattr(ha, 'hamon_type', '') or 'Hamon'
        results.append({
            'type': 'hamon_ability',
            'id': ha.id,
            'title': ha.name or 'Unnamed',
            'subtitle': f"Hamon • {type_label}",
            'description': desc[:100] + '...' if len(desc) > 100 else desc,
            'url': f'/abilities-hamon',
            'campaign': None
        })

    # Search Spin Abilities (playbook)
    spin_queryset = SpinAbility.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]

    for sa in spin_queryset:
        desc = sa.description or ''
        try:
            type_label = sa.get_spin_type_display()
        except (AttributeError, ValueError):
            type_label = getattr(sa, 'spin_type', '') or 'Spin'
        results.append({
            'type': 'spin_ability',
            'id': sa.id,
            'title': sa.name or 'Unnamed',
            'subtitle': f"Spin • {type_label}",
            'description': desc[:100] + '...' if len(desc) > 100 else desc,
            'url': f'/abilities-spin',
            'campaign': None
        })

    # Search Stand Abilities (Stand-specific)
    stand_ability_queryset = StandAbility.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query)
    )[:10]

    for sta in stand_ability_queryset:
        desc = sta.description or ''
        stand_name = sta.stand.name if sta.stand else 'Stand'
        results.append({
            'type': 'stand_ability',
            'id': sta.id,
            'title': sta.name or 'Unnamed',
            'subtitle': f"Stand Ability • {stand_name}",
            'description': desc[:100] + '...' if len(desc) > 100 else desc,
            'url': f'/abilities-stand',
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
            'url': f'/abilities-heritage',
            'campaign': None
        })

    return Response({
        'results': results,
        'total': len(results),
        'query': query
    })


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