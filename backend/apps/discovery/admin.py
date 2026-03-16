from django.contrib import admin

from .models import DiscoveryResult, DiscoveryRun


@admin.register(DiscoveryRun)
class DiscoveryRunAdmin(admin.ModelAdmin):
    list_display = ["client", "run_date", "status", "total_keywords_found", "new_keywords_found"]
    list_filter = ["status", "run_date"]
    raw_id_fields = ["client"]
    date_hierarchy = "run_date"


@admin.register(DiscoveryResult)
class DiscoveryResultAdmin(admin.ModelAdmin):
    list_display = ["keyword_text", "client", "rank_absolute", "search_volume", "is_new", "is_interesting"]
    list_filter = ["is_new", "is_interesting", "is_promoted"]
    search_fields = ["keyword_text"]
    raw_id_fields = ["run", "client"]
