from django.db.models import Avg, Count, Q, Sum
from rest_framework import serializers

from .models import Client


class ClientListSerializer(serializers.ModelSerializer):
    """Rich serializer for the clients list page — BrightLocal style."""
    tracked_keywords_count = serializers.SerializerMethodField()
    discovered_keywords_count = serializers.SerializerMethodField()
    rankings_up = serializers.SerializerMethodField()
    rankings_down = serializers.SerializerMethodField()
    rankings_new = serializers.SerializerMethodField()
    avg_position = serializers.SerializerMethodField()
    organic_sessions = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def get_tracked_keywords_count(self, obj):
        return obj.keywords.filter(status="tracked").count()

    def get_discovered_keywords_count(self, obj):
        return obj.keywords.filter(status="discovered").count()

    def get_rankings_up(self, obj):
        return obj.keywords.filter(status="tracked", rank_change__gt=0).count()

    def get_rankings_down(self, obj):
        return obj.keywords.filter(status="tracked", rank_change__lt=0).count()

    def get_rankings_new(self, obj):
        return obj.keywords.filter(
            status="tracked",
            current_organic_rank__isnull=False,
            previous_organic_rank__isnull=True,
        ).count()

    def get_avg_position(self, obj):
        result = obj.keywords.filter(
            status="tracked",
            current_organic_rank__isnull=False,
        ).aggregate(avg=Avg("current_organic_rank"))
        return round(result["avg"], 1) if result["avg"] else None

    def get_organic_sessions(self, obj):
        latest = obj.ga4_traffic.order_by("-date").first()
        return latest.organic_sessions if latest else None


class ClientSerializer(serializers.ModelSerializer):
    """Simple serializer for create/update operations."""
    tracked_keywords_count = serializers.SerializerMethodField()
    discovered_keywords_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def get_tracked_keywords_count(self, obj):
        return obj.keywords.filter(status="tracked").count()

    def get_discovered_keywords_count(self, obj):
        return obj.keywords.filter(status="discovered").count()


class ClientSummarySerializer(serializers.Serializer):
    client = ClientSerializer()
    total_tracked_keywords = serializers.IntegerField()
    total_discovered_keywords = serializers.IntegerField()
    keywords_in_top_3 = serializers.IntegerField()
    keywords_in_top_10 = serializers.IntegerField()
    keywords_improved = serializers.IntegerField()
    keywords_declined = serializers.IntegerField()
    last_discovery_run = serializers.DateField(allow_null=True)
    last_rank_check = serializers.DateField(allow_null=True)
