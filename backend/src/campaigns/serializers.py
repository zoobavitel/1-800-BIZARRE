from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Campaign, Session, ChatMessage

class CampaignSerializer(serializers.ModelSerializer):
    gm = serializers.PrimaryKeyRelatedField(read_only=True) # UserSerializer(read_only=True)
    players = serializers.PrimaryKeyRelatedField(many=True, read_only=True) # UserSerializer(many=True, read_only=True)
    # wanted stars may be set by GM
    wanted_stars = serializers.IntegerField()
    class Meta:
        model  = Campaign
        fields = ['id','name','gm','players','description','wanted_stars','factions']


class SessionSerializer(serializers.ModelSerializer):
    # These will need to be updated to point to the correct apps later
    npcs_involved = serializers.PrimaryKeyRelatedField(many=True, queryset=serializers.ALL_BY_MODEL['characters.NPC'], required=False)
    characters_involved = serializers.PrimaryKeyRelatedField(many=True, queryset=serializers.ALL_BY_MODEL['characters.Character'], required=False)
    proposed_by = serializers.PrimaryKeyRelatedField(read_only=True) # UserSerializer(read_only=True)
    votes = serializers.PrimaryKeyRelatedField(many=True, read_only=True) # UserSerializer(many=True, read_only=True)

    class Meta:
        model = Session
        fields = '__all__'
        read_only_fields = ['session_date']

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = '__all__'
