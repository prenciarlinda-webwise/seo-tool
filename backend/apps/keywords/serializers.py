from rest_framework import serializers

from .models import Keyword, KeywordTag


class KeywordTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = KeywordTag
        fields = "__all__"


class KeywordSerializer(serializers.ModelSerializer):
    tags = KeywordTagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=KeywordTag.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source="tags",
    )
    effective_location_code = serializers.IntegerField(read_only=True)
    effective_language_code = serializers.CharField(read_only=True)

    class Meta:
        model = Keyword
        fields = "__all__"
        read_only_fields = [
            "created_at", "updated_at", "client",
            "current_organic_rank", "current_organic_url",
            "current_maps_rank", "previous_organic_rank",
            "previous_maps_rank", "rank_change", "last_checked_at",
        ]


class BulkStatusSerializer(serializers.Serializer):
    keyword_ids = serializers.ListField(child=serializers.IntegerField())
    status = serializers.ChoiceField(choices=["tracked", "discovered", "ignored", "paused"])
