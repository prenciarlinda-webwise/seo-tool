from rest_framework import serializers
from .models import BacklinkSnapshot, Backlink, ReferringDomain, AnchorText

class BacklinkSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BacklinkSnapshot
        fields = "__all__"
        read_only_fields = ["created_at"]

class BacklinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Backlink
        fields = "__all__"
        read_only_fields = ["created_at"]

class ReferringDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferringDomain
        fields = "__all__"
        read_only_fields = ["created_at"]

class AnchorTextSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnchorText
        fields = "__all__"
        read_only_fields = ["created_at"]
