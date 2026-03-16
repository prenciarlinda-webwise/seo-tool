from rest_framework import generics

from .models import GBPCallMetric, GBPPerformanceMetric, GBPReviewSnapshot, GBPSearchKeyword
from .serializers import (
    GBPCallMetricSerializer,
    GBPPerformanceMetricSerializer,
    GBPReviewSnapshotSerializer,
    GBPSearchKeywordSerializer,
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


class GBPPerformanceListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GBPPerformanceMetricSerializer
    ordering_fields = ["date", "total_impressions", "total_interactions"]

    def get_queryset(self):
        qs = GBPPerformanceMetric.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class GBPCallListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GBPCallMetricSerializer
    ordering_fields = ["date", "total_calls"]

    def get_queryset(self):
        qs = GBPCallMetric.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class GBPReviewListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GBPReviewSnapshotSerializer
    ordering_fields = ["date", "total_reviews", "average_rating"]

    def get_queryset(self):
        qs = GBPReviewSnapshot.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs)


class GBPSearchKeywordListView(DateRangeFilterMixin, generics.ListAPIView):
    serializer_class = GBPSearchKeywordSerializer
    search_fields = ["keyword"]
    ordering_fields = ["impressions", "period_start"]

    def get_queryset(self):
        qs = GBPSearchKeyword.objects.filter(client_id=self.kwargs["client_pk"])
        return self.filter_by_date_range(qs, date_field="period_start")
