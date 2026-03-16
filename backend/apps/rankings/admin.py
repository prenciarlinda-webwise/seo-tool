from django.contrib import admin

from .models import LocalFinderResult, MapsRankResult, SERPResult


@admin.register(SERPResult)
class SERPResultAdmin(admin.ModelAdmin):
    list_display = ["keyword", "client", "checked_at", "rank_absolute", "is_found", "rank_change"]
    list_filter = ["is_found", "checked_at"]
    raw_id_fields = ["keyword", "client"]
    date_hierarchy = "checked_at"


@admin.register(MapsRankResult)
class MapsRankResultAdmin(admin.ModelAdmin):
    list_display = ["keyword", "client", "checked_at", "rank_group", "is_found", "rank_change"]
    list_filter = ["is_found", "checked_at"]
    raw_id_fields = ["keyword", "client"]
    date_hierarchy = "checked_at"


@admin.register(LocalFinderResult)
class LocalFinderResultAdmin(admin.ModelAdmin):
    list_display = ["keyword", "client", "checked_at", "rank", "is_found", "rank_change"]
    list_filter = ["is_found", "checked_at"]
    raw_id_fields = ["keyword", "client"]
    date_hierarchy = "checked_at"
