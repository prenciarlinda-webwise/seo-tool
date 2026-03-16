from django.db import models


class Competitor(models.Model):
    """A competitor domain being tracked for a client."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="competitors")
    domain = models.CharField(max_length=255, db_index=True)
    name = models.CharField(max_length=255, blank=True)
    is_auto_discovered = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "domain")]
        ordering = ["domain"]

    def __str__(self):
        return f"{self.domain} (competitor of {self.client.domain})"


class CompetitorSnapshot(models.Model):
    """Periodic competitive analysis snapshot."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="competitor_snapshots")
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name="snapshots")
    date = models.DateField(db_index=True)

    # Visibility metrics
    shared_keywords = models.IntegerField(default=0)
    competitor_keywords = models.IntegerField(default=0)
    avg_position = models.FloatField(null=True, blank=True)
    estimated_traffic = models.FloatField(null=True, blank=True)

    # Domain metrics
    domain_rank = models.IntegerField(null=True, blank=True)
    backlinks_count = models.IntegerField(null=True, blank=True)
    referring_domains = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("competitor", "date")]
        ordering = ["-date"]
        indexes = [models.Index(fields=["client", "-date"])]

    def __str__(self):
        return f"{self.competitor.domain} snapshot @ {self.date}"


class CompetitorKeywordOverlap(models.Model):
    """Keywords where client and competitor both rank."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="competitor_overlaps")
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name="overlaps")
    date = models.DateField(db_index=True)

    keyword_text = models.CharField(max_length=500, db_index=True)
    search_volume = models.IntegerField(null=True, blank=True)

    client_rank = models.IntegerField(null=True, blank=True)
    competitor_rank = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-search_volume"]
        indexes = [
            models.Index(fields=["client", "competitor", "-date"]),
        ]

    def __str__(self):
        return f'"{self.keyword_text}" client=#{self.client_rank} vs {self.competitor.domain}=#{self.competitor_rank}'
