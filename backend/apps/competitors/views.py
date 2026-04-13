from rest_framework import viewsets

from apps.clients.models import Client

from .models import Competitor
from .serializers import CompetitorSerializer


class CompetitorViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitorSerializer
    search_fields = ["domain", "name"]

    def get_queryset(self):
        return Competitor.objects.filter(client__slug=self.kwargs["client_slug"])

    def perform_create(self, serializer):
        client = Client.objects.get(slug=self.kwargs["client_slug"])
        serializer.save(client=client)
