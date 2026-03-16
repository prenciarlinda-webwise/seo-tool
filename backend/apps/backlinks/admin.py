from django.contrib import admin

from .models import AnchorText, Backlink, BacklinkSnapshot, ReferringDomain


@admin.register(BacklinkSnapshot)
class BacklinkSnapshotAdmin(admin.ModelAdmin):
    list_display = [
        "client", "date", "total_backlinks", "referring_domains",
        "dofollow", "nofollow", "new_backlinks", "lost_backlinks",
    ]
    list_filter = ["date"]
    raw_id_fields = ["client"]
    date_hierarchy = "date"


@admin.register(Backlink)
class BacklinkAdmin(admin.ModelAdmin):
    list_display = [
        "source_domain", "target_url", "client", "anchor",
        "is_dofollow", "is_new", "is_lost", "first_seen",
    ]
    list_filter = ["is_dofollow", "is_new", "is_lost"]
    search_fields = ["source_url", "source_domain", "target_url", "anchor"]
    raw_id_fields = ["client", "snapshot"]


@admin.register(ReferringDomain)
class ReferringDomainAdmin(admin.ModelAdmin):
    list_display = [
        "domain", "client", "backlinks_count",
        "dofollow_count", "nofollow_count", "rank", "spam_score",
    ]
    list_filter = []
    search_fields = ["domain"]
    raw_id_fields = ["client", "snapshot"]


@admin.register(AnchorText)
class AnchorTextAdmin(admin.ModelAdmin):
    list_display = ["anchor", "client", "backlinks_count", "referring_domains", "dofollow"]
    search_fields = ["anchor"]
    raw_id_fields = ["client", "snapshot"]
