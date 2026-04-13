from rest_framework import generics

from .models import AuditPage, LighthouseResult, SiteAudit
from .serializers import AuditPageSerializer, LighthouseResultSerializer, SiteAuditSerializer


class SiteAuditListView(generics.ListAPIView):
    serializer_class = SiteAuditSerializer

    def get_queryset(self):
        return SiteAudit.objects.filter(client__slug=self.kwargs["client_slug"])


class SiteAuditDetailView(generics.RetrieveAPIView):
    serializer_class = SiteAuditSerializer
    lookup_url_kwarg = "audit_pk"

    def get_queryset(self):
        return SiteAudit.objects.filter(client__slug=self.kwargs["client_slug"])


class AuditPageListView(generics.ListAPIView):
    serializer_class = AuditPageSerializer
    search_fields = ["url"]
    filterset_fields = ["status_code"]

    def get_queryset(self):
        return AuditPage.objects.filter(
            audit_id=self.kwargs["audit_pk"],
            audit__client__slug=self.kwargs["client_slug"],
        )


class LighthouseListView(generics.ListAPIView):
    serializer_class = LighthouseResultSerializer

    def get_queryset(self):
        return LighthouseResult.objects.filter(client__slug=self.kwargs["client_slug"])
