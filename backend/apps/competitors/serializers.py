from rest_framework import serializers

from .models import Competitor, CompetitorSnapshot


class CompetitorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competitor
        fields = "__all__"
        read_only_fields = ["created_at"]


class CompetitorSnapshotSerializer(serializers.ModelSerializer):
    domain = serializers.CharField(source="competitor.domain", read_only=True)

    class Meta:
        model = CompetitorSnapshot
        fields = "__all__"
        read_only_fields = ["created_at"]
