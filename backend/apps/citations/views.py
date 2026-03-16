from rest_framework import viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Citation, CitationDirectory
from .serializers import CitationSerializer, CitationDirectorySerializer


class CitationDirectoryViewSet(viewsets.ModelViewSet):
    queryset = CitationDirectory.objects.all()
    serializer_class = CitationDirectorySerializer
    search_fields = ["name"]
    filterset_fields = ["is_key_citation", "category"]


class CitationViewSet(viewsets.ModelViewSet):
    serializer_class = CitationSerializer
    search_fields = ["directory__name", "listed_name"]
    filterset_fields = ["status"]

    def get_queryset(self):
        return Citation.objects.filter(
            client_id=self.kwargs["client_pk"]
        ).select_related("directory")

    def perform_create(self, serializer):
        serializer.save(client_id=self.kwargs["client_pk"])


class CitationCheckView(APIView):
    """Trigger citation NAP checking for a client."""

    def post(self, request, client_pk):
        from .tasks import check_citations_for_client
        check_citations_for_client.delay(client_pk)
        return Response({"message": "Citation check triggered."})


class CitationSummaryView(APIView):
    def get(self, request, client_pk):
        citations = Citation.objects.filter(client_id=client_pk).select_related("directory")
        total = citations.count()
        found = citations.filter(status__in=["found", "claimed"]).count()
        claimed = citations.filter(status="claimed").count()
        not_found = citations.filter(status="not_found").count()

        nap_errors = {"name": 0, "address": 0, "phone": 0, "zip": 0}
        for c in citations:
            if c.name_accurate is False: nap_errors["name"] += 1
            if c.address_accurate is False: nap_errors["address"] += 1
            if c.phone_accurate is False: nap_errors["phone"] += 1
            if c.zip_accurate is False: nap_errors["zip"] += 1

        key_total = citations.filter(directory__is_key_citation=True).count()
        key_found = citations.filter(directory__is_key_citation=True, status__in=["found", "claimed"]).count()

        return Response({
            "total": total,
            "found": found,
            "claimed": claimed,
            "not_found": not_found,
            "nap_errors": nap_errors,
            "key_citation_score": round((key_found / key_total * 100) if key_total > 0 else 0),
            "percentage_found": round((found / total * 100) if total > 0 else 0),
        })
