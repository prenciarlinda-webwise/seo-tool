from django.db import models


class ContentMentionSnapshot(models.Model):
    """Periodic snapshot of brand/keyword mentions across the web."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="content_mention_snapshots")
    keyword = models.CharField(max_length=500)  # The tracked mention keyword (usually brand name)
    date = models.DateField(db_index=True)

    total_mentions = models.IntegerField(default=0)
    positive_mentions = models.IntegerField(default=0)
    negative_mentions = models.IntegerField(default=0)
    neutral_mentions = models.IntegerField(default=0)
    avg_sentiment_score = models.FloatField(null=True, blank=True)  # -1 to 1
    avg_rating = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "keyword", "date")]
        ordering = ["-date"]
        indexes = [models.Index(fields=["client", "-date"])]

    def __str__(self):
        return f'"{self.keyword}" mentions @ {self.date} ({self.total_mentions} total)'


class ContentMention(models.Model):
    """Individual content mention/citation."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="content_mentions")
    snapshot = models.ForeignKey(ContentMentionSnapshot, on_delete=models.CASCADE, related_name="mentions", null=True, blank=True)

    url = models.URLField(max_length=2048)
    domain = models.CharField(max_length=255, db_index=True)
    title = models.CharField(max_length=1000, blank=True)

    # Content details
    snippet = models.TextField(blank=True)
    publication_date = models.DateField(null=True, blank=True)

    # Sentiment
    sentiment = models.CharField(max_length=10, blank=True)  # positive, negative, neutral
    sentiment_score = models.FloatField(null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)

    # Social signals
    social_shares = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-publication_date"]
        indexes = [
            models.Index(fields=["client", "-publication_date"]),
            models.Index(fields=["client", "sentiment"]),
        ]

    def __str__(self):
        return f"{self.domain}: {self.title[:50]}" if self.title else self.url
