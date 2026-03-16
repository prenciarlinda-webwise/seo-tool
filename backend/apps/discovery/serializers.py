from rest_framework import serializers

from .models import DiscoveryResult, DiscoveryRun


class DiscoveryRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveryRun
        fields = "__all__"
        read_only_fields = ["__all__"]


class DiscoveryResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscoveryResult
        fields = "__all__"
        read_only_fields = ["__all__"]


class PromoteKeywordsSerializer(serializers.Serializer):
    keyword_texts = serializers.ListField(child=serializers.CharField(max_length=500))
