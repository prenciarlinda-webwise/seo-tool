from django.contrib import admin

from .models import ContentMention, ContentMentionSnapshot


@admin.register(ContentMentionSnapshot)
class ContentMentionSnapshotAdmin(admin.ModelAdmin):
    list_display = [
        "keyword", "client", "date", "total_mentions",
        "positive_mentions", "negative_mentions", "neutral_mentions", "avg_sentiment_score",
    ]
    list_filter = ["date"]
    search_fields = ["keyword", "client__domain"]
    raw_id_fields = ["client"]
    date_hierarchy = "date"


@admin.register(ContentMention)
class ContentMentionAdmin(admin.ModelAdmin):
    list_display = [
        "domain", "title", "client", "sentiment",
        "sentiment_score", "publication_date",
    ]
    list_filter = ["sentiment"]
    search_fields = ["url", "domain", "title"]
    raw_id_fields = ["client", "snapshot"]
