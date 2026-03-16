from django.contrib import admin

from .models import GBPCallMetric, GBPPerformanceMetric, GBPReviewSnapshot, GBPSearchKeyword


@admin.register(GBPPerformanceMetric)
class GBPPerformanceMetricAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "total_impressions", "total_interactions", "call_clicks", "website_clicks"]
    list_filter = ["date"]
    raw_id_fields = ["client"]
    date_hierarchy = "date"


@admin.register(GBPCallMetric)
class GBPCallMetricAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "total_calls", "answered_calls", "missed_calls", "avg_duration_seconds"]
    list_filter = ["date"]
    raw_id_fields = ["client"]
    date_hierarchy = "date"


@admin.register(GBPReviewSnapshot)
class GBPReviewSnapshotAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "total_reviews", "average_rating", "new_reviews_since_last", "response_rate"]
    list_filter = ["date"]
    raw_id_fields = ["client"]
    date_hierarchy = "date"


@admin.register(GBPSearchKeyword)
class GBPSearchKeywordAdmin(admin.ModelAdmin):
    list_display = ["client", "keyword", "impressions", "period_start", "period_end"]
    search_fields = ["keyword"]
    raw_id_fields = ["client"]
