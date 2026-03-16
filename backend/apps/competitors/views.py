from rest_framework import viewsets

from .models import Competitor
from .serializers import CompetitorSerializer


class CompetitorViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitorSerializer
    search_fields = ["domain", "name"]

    def get_queryset(self):
        return Competitor.objects.filter(client_id=self.kwargs["client_pk"])

    def perform_create(self, serializer):
        serializer.save(client_id=self.kwargs["client_pk"])
