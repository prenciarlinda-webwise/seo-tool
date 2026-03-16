from rest_framework import generics, viewsets

from .models import GA4ConversionSummary, GA4Event, GA4LandingPage, GA4Property, GA4TrafficSnapshot
from .serializers import (
    GA4ConversionSummarySerializer,
    GA4EventSerializer,
    GA4LandingPageSerializer,
    GA4PropertySerializer,
    GA4TrafficSnapshotSerializer,
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


class GA4PropertyViewSet(viewsets.ModelViewSet):
    serializer_class = GA4PropertySerializer

    def get_queryset(self):
        return GA4Property.objects.filter(client_id=self.kwargs["client_pk"])

    def perform_create(self, serializer):
        serializer.save(client_id=self.kwargs["client_pk"])


class GA4TrafficListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GA4TrafficSnapshotSerializer
    ordering_fields = ["date", "organic_sessions", "organic_users"]

    def get_queryset(self):
        qs = GA4TrafficSnapshot.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class GA4LandingPageListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GA4LandingPageSerializer
    search_fields = ["page_path"]
    ordering_fields = ["date", "organic_sessions"]

    def get_queryset(self):
        qs = GA4LandingPage.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class GA4EventListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GA4EventSerializer
    filterset_fields = ["event_name", "is_conversion", "is_key_event"]
    ordering_fields = ["date", "event_count", "organic_event_count"]

    def get_queryset(self):
        qs = GA4Event.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class GA4ConversionSummaryListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GA4ConversionSummarySerializer
    ordering_fields = ["date", "total_conversions", "organic_conversions"]

    def get_queryset(self):
        qs = GA4ConversionSummary.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)
