from django.db import models


class DiscoveryRun(models.Model):
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="discovery_runs")
    run_date = models.DateField(db_index=True)

    # Summary stats
    total_keywords_found = models.IntegerField(default=0)
    new_keywords_found = models.IntegerField(default=0)
    keywords_in_top_10 = models.IntegerField(default=0)
    keywords_in_top_20 = models.IntegerField(default=0)
    keywords_in_top_100 = models.IntegerField(default=0)
    avg_position = models.FloatField(null=True, blank=True)
    total_estimated_traffic = models.FloatField(null=True, blank=True)

    # Run metadata
    status = models.CharField(max_length=20, default="pending")
    error_message = models.TextField(blank=True)
    dataforseo_task_id = models.CharField(max_length=255, blank=True)
    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-run_date"]
        unique_together = [("client", "run_date")]

    def __str__(self):
        return f"Discovery: {self.client.domain} on {self.run_date}"


class DiscoveryResult(models.Model):
    run = models.ForeignKey(DiscoveryRun, on_delete=models.CASCADE, related_name="results")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="discovery_results")

    # Keyword data
    keyword_text = models.CharField(max_length=500, db_index=True)
    rank_absolute = models.IntegerField(null=True, blank=True)
    url = models.URLField(max_length=2048, blank=True)

    # Search metrics
    search_volume = models.IntegerField(null=True, blank=True)
    competition = models.FloatField(null=True, blank=True)
    competition_level = models.CharField(max_length=20, blank=True)
    cpc = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estimated_traffic = models.FloatField(null=True, blank=True)
    keyword_difficulty = models.IntegerField(null=True, blank=True)

    # Monthly search volume trend
    monthly_searches = models.JSONField(null=True, blank=True)

    # Source
    RANKED = "ranked"
    COMPETITOR_GAP = "competitor_gap"
    SOURCE_CHOICES = [
        (RANKED, "Already Ranking"),
        (COMPETITOR_GAP, "Competitor Gap"),
    ]
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=RANKED)
    competitor_domain = models.CharField(max_length=255, blank=True)  # Which competitor it came from

    # Flags
    is_new = models.BooleanField(default=False)
    is_promoted = models.BooleanField(default=False)
    is_interesting = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-search_volume"]
        indexes = [
            models.Index(fields=["client", "-search_volume"]),
            models.Index(fields=["client", "keyword_text"]),
            models.Index(fields=["run", "is_new"]),
        ]

    def __str__(self):
        return f"{self.keyword_text} (rank #{self.rank_absolute})"
