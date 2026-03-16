from django.contrib import admin

from .models import AuditPage, LighthouseResult, SiteAudit


@admin.register(SiteAudit)
class SiteAuditAdmin(admin.ModelAdmin):
    list_display = [
        "client", "target_url", "status", "pages_crawled",
        "pages_with_errors", "pages_with_warnings", "created_at",
    ]
    list_filter = ["status", "has_ssl", "has_robots_txt", "has_sitemap"]
    raw_id_fields = ["client"]
    search_fields = ["target_url", "client__domain"]
    date_hierarchy = "created_at"


@admin.register(AuditPage)
class AuditPageAdmin(admin.ModelAdmin):
    list_display = [
        "url", "client", "status_code", "word_count",
        "is_indexable", "is_duplicate_title", "broken_links_count",
    ]
    list_filter = ["status_code", "is_indexable", "has_schema", "is_duplicate_title"]
    search_fields = ["url", "title"]
    raw_id_fields = ["audit", "client"]


@admin.register(LighthouseResult)
class LighthouseResultAdmin(admin.ModelAdmin):
    list_display = [
        "url", "client", "is_mobile", "performance_score",
        "accessibility_score", "best_practices_score", "seo_score", "created_at",
    ]
    list_filter = ["is_mobile"]
    search_fields = ["url"]
    raw_id_fields = ["client", "audit"]
    date_hierarchy = "created_at"
