from django.db import models


class GBPPerformanceMetric(models.Model):
    """Daily performance metrics from Google Business Profile."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="gbp_performance")
    date = models.DateField(db_index=True)

    # Search performance
    business_impressions_desktop_maps = models.IntegerField(default=0)
    business_impressions_desktop_search = models.IntegerField(default=0)
    business_impressions_mobile_maps = models.IntegerField(default=0)
    business_impressions_mobile_search = models.IntegerField(default=0)
    total_impressions = models.IntegerField(default=0)

    # Actions / interactions
    call_clicks = models.IntegerField(default=0)
    website_clicks = models.IntegerField(default=0)
    direction_requests = models.IntegerField(default=0)
    business_conversations = models.IntegerField(default=0)
    business_bookings = models.IntegerField(default=0)
    total_interactions = models.IntegerField(default=0)

    # Photos
    photos_views_merchant = models.IntegerField(default=0)
    photos_views_customers = models.IntegerField(default=0)
    photos_count_merchant = models.IntegerField(default=0)
    photos_count_customers = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "date")]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["client", "-date"]),
        ]

    def __str__(self):
        return f"{self.client.domain} GBP metrics {self.date}"


class GBPCallMetric(models.Model):
    """Call tracking data from GBP (individual call records or daily aggregates)."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="gbp_calls")
    date = models.DateField(db_index=True)

    # Call data
    total_calls = models.IntegerField(default=0)
    answered_calls = models.IntegerField(default=0)
    missed_calls = models.IntegerField(default=0)
    avg_duration_seconds = models.IntegerField(null=True, blank=True)
    total_duration_seconds = models.IntegerField(default=0)

    # Breakdown by hour (optional, for heatmap visualization)
    calls_by_hour = models.JSONField(null=True, blank=True)
    # Format: {"0": 0, "1": 0, ..., "23": 2}

    # Breakdown by day of week
    calls_by_day_of_week = models.JSONField(null=True, blank=True)
    # Format: {"monday": 5, "tuesday": 3, ...}

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "date")]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["client", "-date"]),
        ]

    def __str__(self):
        return f"{self.client.domain} calls {self.date}: {self.total_calls}"


class GBPReviewSnapshot(models.Model):
    """Periodic snapshot of review stats from GBP."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="gbp_reviews")
    date = models.DateField(db_index=True)

    # Aggregate stats
    total_reviews = models.IntegerField(default=0)
    average_rating = models.FloatField(null=True, blank=True)
    new_reviews_since_last = models.IntegerField(default=0)
    rating_change = models.FloatField(null=True, blank=True)

    # Rating distribution
    five_star = models.IntegerField(default=0)
    four_star = models.IntegerField(default=0)
    three_star = models.IntegerField(default=0)
    two_star = models.IntegerField(default=0)
    one_star = models.IntegerField(default=0)

    # Response stats
    total_responded = models.IntegerField(default=0)
    response_rate = models.FloatField(null=True, blank=True)       # 0-1

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "date")]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["client", "-date"]),
        ]

    def __str__(self):
        return f"{self.client.domain} reviews {self.date}: {self.average_rating} ({self.total_reviews})"


class GBPSearchKeyword(models.Model):
    """Keywords people used to find the business on Google (from GBP Insights)."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="gbp_search_keywords")
    period_start = models.DateField(db_index=True)
    period_end = models.DateField()

    keyword = models.CharField(max_length=500, db_index=True)
    impressions = models.IntegerField(default=0)

    # Change vs previous period
    previous_impressions = models.IntegerField(null=True, blank=True)
    impressions_change = models.IntegerField(null=True, blank=True)
    impressions_change_pct = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "period_start", "keyword")]
        ordering = ["-impressions"]
        indexes = [
            models.Index(fields=["client", "-period_start"]),
            models.Index(fields=["client", "-impressions"]),
        ]

    def __str__(self):
        return f"{self.keyword}: {self.impressions} impressions"
