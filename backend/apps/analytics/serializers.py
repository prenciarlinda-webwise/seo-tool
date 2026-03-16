from rest_framework import serializers

from .models import GA4ConversionSummary, GA4Event, GA4LandingPage, GA4Property, GA4TrafficSnapshot


class GA4PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = GA4Property
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class GA4TrafficSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = GA4TrafficSnapshot
        fields = "__all__"
        read_only_fields = ["created_at"]


class GA4LandingPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GA4LandingPage
        fields = "__all__"
        read_only_fields = ["created_at"]


class GA4EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = GA4Event
        fields = "__all__"
        read_only_fields = ["created_at"]


class GA4ConversionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = GA4ConversionSummary
        fields = "__all__"
        read_only_fields = ["created_at"]
