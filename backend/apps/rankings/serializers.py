from rest_framework import serializers

from .models import LocalFinderResult, MapsRankResult, SERPResult


class SERPResultSerializer(serializers.ModelSerializer):
    keyword_text = serializers.CharField(source="keyword.keyword_text", read_only=True)

    class Meta:
        model = SERPResult
        exclude = ["raw_response"]


class MapsRankResultSerializer(serializers.ModelSerializer):
    keyword_text = serializers.CharField(source="keyword.keyword_text", read_only=True)

    class Meta:
        model = MapsRankResult
        exclude = ["raw_response"]


class LocalFinderResultSerializer(serializers.ModelSerializer):
    keyword_text = serializers.CharField(source="keyword.keyword_text", read_only=True)

    class Meta:
        model = LocalFinderResult
        exclude = ["raw_response"]


class LatestRankSerializer(serializers.Serializer):
    keyword_id = serializers.IntegerField()
    keyword_text = serializers.CharField()
    organic_rank = serializers.IntegerField(allow_null=True)
    organic_url = serializers.CharField(allow_blank=True)
    organic_rank_change = serializers.IntegerField(allow_null=True)
    mobile_rank = serializers.IntegerField(allow_null=True)
    mobile_url = serializers.CharField(allow_blank=True)
    mobile_rank_change = serializers.IntegerField(allow_null=True)
    maps_rank = serializers.IntegerField(allow_null=True)
    maps_rank_change = serializers.IntegerField(allow_null=True)
    last_checked = serializers.DateField(allow_null=True)
