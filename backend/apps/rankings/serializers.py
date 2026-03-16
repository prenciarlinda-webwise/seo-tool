from rest_framework import serializers

from .models import MapsRankResult, SERPResult


class SERPResultSerializer(serializers.ModelSerializer):
    keyword_text = serializers.CharField(source="keyword.keyword_text", read_only=True)

    class Meta:
        model = SERPResult
        exclude = ["raw_response"]
        read_only_fields = ["__all__"]


class MapsRankResultSerializer(serializers.ModelSerializer):
    keyword_text = serializers.CharField(source="keyword.keyword_text", read_only=True)

    class Meta:
        model = MapsRankResult
        exclude = ["raw_response"]
        read_only_fields = ["__all__"]


class LatestRankSerializer(serializers.Serializer):
    keyword_id = serializers.IntegerField()
    keyword_text = serializers.CharField()
    organic_rank = serializers.IntegerField(allow_null=True)
    organic_url = serializers.CharField(allow_blank=True)
    organic_rank_change = serializers.IntegerField(allow_null=True)
    maps_rank = serializers.IntegerField(allow_null=True)
    maps_rank_change = serializers.IntegerField(allow_null=True)
    last_checked = serializers.DateField(allow_null=True)
