from rest_framework import serializers

from .models import AuditPage, LighthouseResult, SiteAudit


class SiteAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteAudit
        fields = "__all__"
        read_only_fields = ["created_at"]


class AuditPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditPage
        fields = "__all__"
        read_only_fields = ["created_at"]


class LighthouseResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LighthouseResult
        fields = "__all__"
        read_only_fields = ["created_at"]
