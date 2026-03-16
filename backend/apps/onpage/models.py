from django.db import models


class SiteAudit(models.Model):
    """One crawl/audit run for a client's website."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="site_audits")

    # Crawl config
    target_url = models.URLField(max_length=2048)
    max_pages = models.IntegerField(default=200)

    # Status
    status = models.CharField(max_length=20, default="pending")  # pending, crawling, completed, failed
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    # Summary stats
    pages_crawled = models.IntegerField(default=0)
    pages_with_errors = models.IntegerField(default=0)
    pages_with_warnings = models.IntegerField(default=0)

    # Technical
    total_4xx_errors = models.IntegerField(default=0)
    total_5xx_errors = models.IntegerField(default=0)
    broken_links_count = models.IntegerField(default=0)
    redirect_chains_count = models.IntegerField(default=0)

    # SEO
    duplicate_titles = models.IntegerField(default=0)
    duplicate_descriptions = models.IntegerField(default=0)
    missing_titles = models.IntegerField(default=0)
    missing_descriptions = models.IntegerField(default=0)
    missing_h1 = models.IntegerField(default=0)
    missing_alt_tags = models.IntegerField(default=0)
    non_indexable_pages = models.IntegerField(default=0)

    # Performance
    avg_page_load_time = models.FloatField(null=True, blank=True)
    avg_page_size = models.IntegerField(null=True, blank=True)  # bytes

    # SSL
    has_ssl = models.BooleanField(null=True)
    ssl_pages = models.IntegerField(default=0)
    non_ssl_pages = models.IntegerField(default=0)

    # Content
    avg_word_count = models.IntegerField(null=True, blank=True)
    thin_content_pages = models.IntegerField(default=0)  # <500 words

    # Robots/Sitemap
    has_robots_txt = models.BooleanField(null=True)
    robots_txt_url = models.URLField(max_length=2048, blank=True)
    has_sitemap = models.BooleanField(null=True)
    sitemap_url = models.URLField(max_length=2048, blank=True)

    # Mobile
    is_responsive = models.BooleanField(null=True)
    is_mobile_friendly = models.BooleanField(null=True)

    dataforseo_task_id = models.CharField(max_length=255, blank=True)
    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["client", "-created_at"])]

    def __str__(self):
        return f"{self.client.domain} audit @ {self.created_at:%Y-%m-%d} ({self.status})"


class AuditPage(models.Model):
    """Individual page result from a site audit."""
    audit = models.ForeignKey(SiteAudit, on_delete=models.CASCADE, related_name="pages")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="audit_pages")

    url = models.URLField(max_length=2048, db_index=True)
    status_code = models.IntegerField(null=True, blank=True)

    # Meta
    title = models.CharField(max_length=1000, blank=True)
    description = models.TextField(blank=True)
    h1 = models.CharField(max_length=1000, blank=True)

    # Content
    word_count = models.IntegerField(null=True, blank=True)
    content_size = models.IntegerField(null=True, blank=True)  # bytes

    # Performance
    page_load_time = models.FloatField(null=True, blank=True)  # ms
    page_size = models.IntegerField(null=True, blank=True)  # bytes

    # Issues (stored as JSON for flexibility)
    errors = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)

    # Links
    internal_links_count = models.IntegerField(default=0)
    external_links_count = models.IntegerField(default=0)
    broken_links_count = models.IntegerField(default=0)

    # Images
    images_count = models.IntegerField(default=0)
    images_missing_alt = models.IntegerField(default=0)

    # Schema
    has_schema = models.BooleanField(default=False)
    schema_types = models.JSONField(default=list, blank=True)

    # Flags
    is_indexable = models.BooleanField(default=True)
    has_canonical = models.BooleanField(default=False)
    canonical_url = models.URLField(max_length=2048, blank=True)
    is_duplicate_title = models.BooleanField(default=False)
    is_duplicate_description = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["url"]
        indexes = [
            models.Index(fields=["audit", "status_code"]),
            models.Index(fields=["client", "url"]),
        ]

    def __str__(self):
        return f"{self.url} ({self.status_code or '?'})"


class LighthouseResult(models.Model):
    """Google Lighthouse audit result."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="lighthouse_results")
    audit = models.ForeignKey(SiteAudit, on_delete=models.CASCADE, related_name="lighthouse_results", null=True, blank=True)

    url = models.URLField(max_length=2048)
    is_mobile = models.BooleanField(default=True)

    # Scores (0-100)
    performance_score = models.IntegerField(null=True, blank=True)
    accessibility_score = models.IntegerField(null=True, blank=True)
    best_practices_score = models.IntegerField(null=True, blank=True)
    seo_score = models.IntegerField(null=True, blank=True)

    # Performance metrics
    first_contentful_paint = models.FloatField(null=True, blank=True)  # ms
    largest_contentful_paint = models.FloatField(null=True, blank=True)  # ms
    total_blocking_time = models.FloatField(null=True, blank=True)  # ms
    cumulative_layout_shift = models.FloatField(null=True, blank=True)
    speed_index = models.FloatField(null=True, blank=True)  # ms
    time_to_interactive = models.FloatField(null=True, blank=True)  # ms

    # Detailed audits stored as JSON
    audits_json = models.JSONField(null=True, blank=True)

    dataforseo_task_id = models.CharField(max_length=255, blank=True)
    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["client", "-created_at"])]

    def __str__(self):
        device = "mobile" if self.is_mobile else "desktop"
        return f"{self.url} ({device}) perf={self.performance_score}"
