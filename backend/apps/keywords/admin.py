from django.contrib import admin

from .models import Keyword, KeywordTag


@admin.register(KeywordTag)
class KeywordTagAdmin(admin.ModelAdmin):
    list_display = ["name", "color"]


@admin.register(Keyword)
class KeywordAdmin(admin.ModelAdmin):
    list_display = [
        "keyword_text", "client", "status", "search_volume",
        "current_organic_rank", "current_maps_rank", "rank_change",
    ]
    list_filter = ["status", "is_branded", "is_primary", "maps_enabled"]
    search_fields = ["keyword_text"]
    raw_id_fields = ["client"]
