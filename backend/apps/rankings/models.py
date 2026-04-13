from django.db import models


class SERPResult(models.Model):
    """One organic SERP snapshot for one keyword on one date and device."""
    keyword = models.ForeignKey("keywords.Keyword", on_delete=models.CASCADE, related_name="serp_results")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="serp_results")

    checked_at = models.DateField(db_index=True)
    device = models.CharField(max_length=10, default="desktop")

    # Position
    rank_absolute = models.IntegerField(null=True, blank=True)
    rank_group = models.IntegerField(null=True, blank=True)
    serp_page = models.IntegerField(null=True, blank=True)
    is_found = models.BooleanField(default=False)

    # Ranking page details
    url = models.URLField(max_length=2048, blank=True)
    title = models.CharField(max_length=1000, blank=True)
    description = models.TextField(blank=True)
    breadcrumb = models.CharField(max_length=1000, blank=True)
    cache_url = models.URLField(max_length=2048, blank=True)

    # SERP evidence
    serp_url = models.URLField(max_length=2048, blank=True)          # Google SERP URL for this query
    screenshot_url = models.URLField(max_length=2048, blank=True)    # Stored screenshot of SERP
    screenshot_urls = models.JSONField(default=list, blank=True)

    # Change tracking
    rank_change = models.IntegerField(null=True, blank=True)
    previous_rank = models.IntegerField(null=True, blank=True)
    url_changed = models.BooleanField(default=False)
    previous_url = models.URLField(max_length=2048, blank=True)

    # SERP features
    featured_snippet_present = models.BooleanField(default=False)
    local_pack_present = models.BooleanField(default=False)
    knowledge_panel_present = models.BooleanField(default=False)
    people_also_ask_present = models.BooleanField(default=False)
    video_results_present = models.BooleanField(default=False)
    images_present = models.BooleanField(default=False)
    shopping_present = models.BooleanField(default=False)
    ai_overview_present = models.BooleanField(default=False)
    total_results_count = models.BigIntegerField(null=True, blank=True)

    # Top competitors
    top_competitors = models.JSONField(default=list, blank=True)

    # DataForSEO metadata
    dataforseo_task_id = models.CharField(max_length=255, blank=True)
    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    raw_response = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("keyword", "checked_at", "device")]
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["keyword", "-checked_at"]),
            models.Index(fields=["client", "-checked_at"]),
            models.Index(fields=["client", "checked_at", "is_found"]),
        ]

    def __str__(self):
        return f"{self.keyword} @ {self.checked_at}: #{self.rank_absolute or 'N/A'}"


class MapsRankResult(models.Model):
    """Local Pack result — the 3-pack shown on organic SERP."""
    keyword = models.ForeignKey("keywords.Keyword", on_delete=models.CASCADE, related_name="maps_results")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="maps_results")

    checked_at = models.DateField(db_index=True)

    # Position
    rank_group = models.IntegerField(null=True, blank=True)
    rank_absolute = models.IntegerField(null=True, blank=True)
    is_found = models.BooleanField(default=False)

    # Business listing details
    title = models.CharField(max_length=500, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=2048, blank=True)
    phone = models.CharField(max_length=50, blank=True)

    # Location
    address = models.CharField(max_length=500, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    # Google identifiers
    place_id = models.CharField(max_length=255, blank=True)
    cid = models.CharField(max_length=255, blank=True)
    feature_id = models.CharField(max_length=255, blank=True)

    # Reviews & rating
    rating_value = models.FloatField(null=True, blank=True)
    rating_count = models.IntegerField(null=True, blank=True)
    rating_change = models.FloatField(null=True, blank=True)
    review_count_change = models.IntegerField(null=True, blank=True)

    # Business attributes
    category = models.CharField(max_length=255, blank=True)
    work_hours = models.JSONField(null=True, blank=True)
    is_claimed = models.BooleanField(null=True)

    # Change tracking
    rank_change = models.IntegerField(null=True, blank=True)
    previous_rank = models.IntegerField(null=True, blank=True)

    # SERP evidence
    serp_url = models.URLField(max_length=2048, blank=True)
    screenshot_url = models.URLField(max_length=2048, blank=True)

    # Top Maps competitors
    top_competitors = models.JSONField(default=list, blank=True)

    # DataForSEO metadata
    dataforseo_task_id = models.CharField(max_length=255, blank=True)
    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    raw_response = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("keyword", "checked_at")]
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["keyword", "-checked_at"]),
            models.Index(fields=["client", "-checked_at"]),
        ]

    def __str__(self):
        return f"{self.keyword} Maps @ {self.checked_at}: #{self.rank_group or 'N/A'}"


class LocalFinderResult(models.Model):
    """Local Finder result — the full Maps/Local listing page (20+ results)."""
    keyword = models.ForeignKey("keywords.Keyword", on_delete=models.CASCADE, related_name="local_finder_results")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="local_finder_results")

    checked_at = models.DateField(db_index=True)

    # Position
    rank = models.IntegerField(null=True, blank=True)
    is_found = models.BooleanField(default=False)

    # Business listing details
    title = models.CharField(max_length=500, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=2048, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=500, blank=True)

    # Google identifiers
    place_id = models.CharField(max_length=255, blank=True)
    cid = models.CharField(max_length=255, blank=True)

    # Reviews
    rating_value = models.FloatField(null=True, blank=True)
    rating_count = models.IntegerField(null=True, blank=True)
    category = models.CharField(max_length=255, blank=True)

    # Change tracking
    rank_change = models.IntegerField(null=True, blank=True)
    previous_rank = models.IntegerField(null=True, blank=True)

    # SERP evidence
    serp_url = models.URLField(max_length=2048, blank=True)
    screenshot_url = models.URLField(max_length=2048, blank=True)

    # DataForSEO metadata
    dataforseo_task_id = models.CharField(max_length=255, blank=True)
    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    raw_response = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("keyword", "checked_at")]
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["keyword", "-checked_at"]),
            models.Index(fields=["client", "-checked_at"]),
        ]

    def __str__(self):
        return f"{self.keyword} Finder @ {self.checked_at}: #{self.rank or 'N/A'}"
