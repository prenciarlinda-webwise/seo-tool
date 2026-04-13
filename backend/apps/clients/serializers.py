from rest_framework import serializers

from .models import Client


class ClientListSerializer(serializers.ModelSerializer):
    """Optimized serializer — all fields come from annotated queryset (single query)."""
    tracked_keywords_count = serializers.IntegerField(read_only=True, default=0)
    discovered_keywords_count = serializers.IntegerField(read_only=True, default=0)
    rankings_up = serializers.IntegerField(read_only=True, default=0)
    rankings_down = serializers.IntegerField(read_only=True, default=0)
    rankings_new = serializers.IntegerField(read_only=True, default=0)
    avg_position = serializers.SerializerMethodField()

    def get_avg_position(self, obj):
        val = getattr(obj, "avg_position", None)
        return round(val, 1) if val is not None else None
    organic_sessions = serializers.IntegerField(read_only=True, default=None)

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class ClientSerializer(serializers.ModelSerializer):
    """Simple serializer for create/update operations."""
    tracked_keywords_count = serializers.IntegerField(read_only=True, default=0)
    discovered_keywords_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


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
