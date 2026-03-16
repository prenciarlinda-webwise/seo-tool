from rest_framework import serializers

from .models import GBPCallMetric, GBPPerformanceMetric, GBPReviewSnapshot, GBPSearchKeyword


class GBPPerformanceMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = GBPPerformanceMetric
        fields = "__all__"
        read_only_fields = ["created_at"]


class GBPCallMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = GBPCallMetric
        fields = "__all__"
        read_only_fields = ["created_at"]


class GBPReviewSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = GBPReviewSnapshot
        fields = "__all__"
        read_only_fields = ["created_at"]


class GBPSearchKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = GBPSearchKeyword
        fields = "__all__"
        read_only_fields = ["created_at"]
