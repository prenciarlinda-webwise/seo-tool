from django.db import models


class GA4Property(models.Model):
    """GA4 property linked to a client for data ingestion."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="ga4_properties")
    property_id = models.CharField(max_length=50, unique=True)       # e.g. "properties/123456789"
    property_name = models.CharField(max_length=255, blank=True)
    measurement_id = models.CharField(max_length=50, blank=True)     # e.g. "G-XXXXXXXX"
    gtm_container_id = models.CharField(max_length=50, blank=True)   # e.g. "GTM-XXXXXX"
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "GA4 properties"

    def __str__(self):
        return f"{self.property_name or self.property_id} ({self.client.domain})"


class GA4TrafficSnapshot(models.Model):
    """Daily organic traffic metrics from GA4."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="ga4_traffic")
    ga4_property = models.ForeignKey(GA4Property, on_delete=models.CASCADE, related_name="traffic_snapshots")
    date = models.DateField(db_index=True)

    # Traffic - organic only
    organic_sessions = models.IntegerField(default=0)
    organic_users = models.IntegerField(default=0)
    organic_new_users = models.IntegerField(default=0)
    organic_pageviews = models.IntegerField(default=0)

    # Traffic - all channels (for context)
    total_sessions = models.IntegerField(default=0)
    total_users = models.IntegerField(default=0)
    total_pageviews = models.IntegerField(default=0)

    # Engagement
    organic_avg_session_duration = models.FloatField(null=True, blank=True)  # seconds
    organic_bounce_rate = models.FloatField(null=True, blank=True)           # 0-1
    organic_engaged_sessions = models.IntegerField(default=0)
    organic_engagement_rate = models.FloatField(null=True, blank=True)       # 0-1

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "ga4_property", "date")]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["client", "-date"]),
            models.Index(fields=["client", "ga4_property", "-date"]),
        ]

    def __str__(self):
        return f"{self.client.domain} traffic {self.date}: {self.organic_sessions} organic sessions"


class GA4LandingPage(models.Model):
    """Daily organic landing page performance from GA4."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="ga4_landing_pages")
    ga4_property = models.ForeignKey(GA4Property, on_delete=models.CASCADE, related_name="landing_pages")
    date = models.DateField(db_index=True)

    page_path = models.CharField(max_length=2048, db_index=True)

    # Metrics
    organic_sessions = models.IntegerField(default=0)
    organic_users = models.IntegerField(default=0)
    organic_pageviews = models.IntegerField(default=0)
    organic_bounce_rate = models.FloatField(null=True, blank=True)
    organic_avg_session_duration = models.FloatField(null=True, blank=True)
    organic_engagement_rate = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "ga4_property", "date", "page_path")]
        ordering = ["-date", "-organic_sessions"]
        indexes = [
            models.Index(fields=["client", "-date"]),
            models.Index(fields=["client", "page_path", "-date"]),
        ]

    def __str__(self):
        return f"{self.page_path}: {self.organic_sessions} sessions ({self.date})"


class GA4Event(models.Model):
    """GTM/GA4 event data — conversions, form submissions, clicks, etc."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="ga4_events")
    ga4_property = models.ForeignKey(GA4Property, on_delete=models.CASCADE, related_name="events")
    date = models.DateField(db_index=True)

    # Event identity
    event_name = models.CharField(max_length=255, db_index=True)     # e.g. "form_submit", "phone_click", "generate_lead"
    is_conversion = models.BooleanField(default=False)               # Marked as conversion in GA4
    is_key_event = models.BooleanField(default=False)                # GA4 key event

    # Counts
    event_count = models.IntegerField(default=0)
    unique_users = models.IntegerField(default=0)

    # Revenue (if applicable)
    event_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Source breakdown (organic vs all)
    organic_event_count = models.IntegerField(default=0)
    organic_unique_users = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "ga4_property", "date", "event_name")]
        ordering = ["-date", "-event_count"]
        indexes = [
            models.Index(fields=["client", "-date"]),
            models.Index(fields=["client", "event_name", "-date"]),
            models.Index(fields=["client", "is_conversion", "-date"]),
        ]

    def __str__(self):
        return f"{self.event_name}: {self.event_count} ({self.date})"


class GA4ConversionSummary(models.Model):
    """Daily aggregate of all conversion/key events per client — for dashboard quick view."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="ga4_conversion_summaries")
    ga4_property = models.ForeignKey(GA4Property, on_delete=models.CASCADE, related_name="conversion_summaries")
    date = models.DateField(db_index=True)

    # Totals across all conversion events
    total_conversions = models.IntegerField(default=0)
    organic_conversions = models.IntegerField(default=0)
    total_conversion_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    organic_conversion_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Common conversion breakdowns
    form_submissions = models.IntegerField(default=0)
    phone_clicks = models.IntegerField(default=0)
    chat_starts = models.IntegerField(default=0)
    purchases = models.IntegerField(default=0)

    # Conversion rate
    organic_conversion_rate = models.FloatField(null=True, blank=True)  # organic conversions / organic sessions

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "ga4_property", "date")]
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["client", "-date"]),
        ]
        verbose_name_plural = "GA4 conversion summaries"

    def __str__(self):
        return f"{self.client.domain} conversions {self.date}: {self.total_conversions}"
