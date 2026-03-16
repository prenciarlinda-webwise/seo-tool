from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BacklinkSnapshot, Backlink, ReferringDomain, AnchorText
from .serializers import (
    BacklinkSnapshotSerializer,
    BacklinkSerializer,
    ReferringDomainSerializer,
    AnchorTextSerializer,
)


class DateRangeFilterMixin:
    def filter_by_date_range(self, qs, date_field="date"):
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(**{f"{date_field}__gte": date_from})
        if date_to:
            qs = qs.filter(**{f"{date_field}__lte": date_to})
        return qs


class BacklinkSnapshotListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = BacklinkSnapshotSerializer

    def get_queryset(self):
        qs = BacklinkSnapshot.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class BacklinkListView(generics.ListAPIView):
    serializer_class = BacklinkSerializer
    search_fields = ["source_domain", "source_url", "anchor"]
    filterset_fields = ["is_dofollow", "is_new", "is_lost"]
    ordering_fields = ["first_seen", "last_seen", "source_rank"]

    def get_queryset(self):
        return Backlink.objects.filter(client_id=self.kwargs["client_pk"])


class ReferringDomainListView(generics.ListAPIView):
    serializer_class = ReferringDomainSerializer
    search_fields = ["domain"]
    ordering_fields = ["backlinks_count", "dofollow_count", "rank", "first_seen"]

    def get_queryset(self):
        return ReferringDomain.objects.filter(client_id=self.kwargs["client_pk"])


class AnchorTextListView(generics.ListAPIView):
    serializer_class = AnchorTextSerializer
    search_fields = ["anchor"]
    ordering_fields = ["backlinks_count", "referring_domains", "dofollow"]

    def get_queryset(self):
        return AnchorText.objects.filter(client_id=self.kwargs["client_pk"])


class BacklinkSummaryView(APIView):
    """Return the latest snapshot summary for a client, or aggregate from records."""

    def get(self, request, client_pk):
        snapshot = (
            BacklinkSnapshot.objects.filter(client_id=client_pk)
            .order_by("-date")
            .first()
        )

        if snapshot:
            data = {
                "total_backlinks": snapshot.total_backlinks,
                "referring_domains": snapshot.referring_domains,
                "dofollow": snapshot.dofollow,
                "nofollow": snapshot.nofollow,
                "rank": snapshot.rank,
                "new_backlinks": snapshot.new_backlinks,
                "lost_backlinks": snapshot.lost_backlinks,
                "new_referring_domains": snapshot.new_referring_domains,
                "lost_referring_domains": snapshot.lost_referring_domains,
                "date": snapshot.date.isoformat(),
            }
        else:
            # Aggregate from individual records
            backlinks = Backlink.objects.filter(client_id=client_pk)
            data = {
                "total_backlinks": backlinks.count(),
                "referring_domains": backlinks.values("source_domain").distinct().count(),
                "dofollow": backlinks.filter(is_dofollow=True).count(),
                "nofollow": backlinks.filter(is_dofollow=False).count(),
                "rank": None,
                "new_backlinks": backlinks.filter(is_new=True).count(),
                "lost_backlinks": backlinks.filter(is_lost=True).count(),
                "new_referring_domains": 0,
                "lost_referring_domains": 0,
                "date": None,
            }

        return Response(data)
