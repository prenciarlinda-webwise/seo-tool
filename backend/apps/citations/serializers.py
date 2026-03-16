from rest_framework import serializers
from .models import Citation, CitationDirectory


class CitationDirectorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CitationDirectory
        fields = "__all__"


class CitationSerializer(serializers.ModelSerializer):
    directory_name = serializers.CharField(source="directory.name", read_only=True)
    directory_url = serializers.URLField(source="directory.url", read_only=True)
    is_key_citation = serializers.BooleanField(source="directory.is_key_citation", read_only=True)
    nap_errors = serializers.IntegerField(read_only=True)

    class Meta:
        model = Citation
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]
