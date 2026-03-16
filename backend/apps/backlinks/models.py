from django.db import models


class BacklinkSnapshot(models.Model):
    """Periodic summary of a client's backlink profile."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="backlink_snapshots")
    date = models.DateField(db_index=True)

    total_backlinks = models.IntegerField(default=0)
    referring_domains = models.IntegerField(default=0)
    referring_ips = models.IntegerField(default=0)
    broken_backlinks = models.IntegerField(default=0)
    broken_pages = models.IntegerField(default=0)

    # Link types
    dofollow = models.IntegerField(default=0)
    nofollow = models.IntegerField(default=0)

    # Domain metrics
    rank = models.IntegerField(null=True, blank=True)  # DataForSEO domain rank

    # Change tracking
    backlinks_change = models.IntegerField(null=True, blank=True)
    domains_change = models.IntegerField(null=True, blank=True)
    new_backlinks = models.IntegerField(default=0)
    lost_backlinks = models.IntegerField(default=0)
    new_referring_domains = models.IntegerField(default=0)
    lost_referring_domains = models.IntegerField(default=0)

    dataforseo_cost = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("client", "date")]
        ordering = ["-date"]
        indexes = [models.Index(fields=["client", "-date"])]

    def __str__(self):
        return f"{self.client.domain} backlinks @ {self.date}"


class Backlink(models.Model):
    """Individual backlink record."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="backlinks")
    snapshot = models.ForeignKey(BacklinkSnapshot, on_delete=models.CASCADE, related_name="backlinks", null=True, blank=True)

    # Source page
    source_url = models.URLField(max_length=2048)
    source_domain = models.CharField(max_length=255, db_index=True)
    source_title = models.CharField(max_length=1000, blank=True)

    # Target page
    target_url = models.URLField(max_length=2048)

    # Link details
    anchor = models.CharField(max_length=1000, blank=True)
    link_type = models.CharField(max_length=20, blank=True)  # "anchor", "image", "redirect", etc
    is_dofollow = models.BooleanField(default=True)
    is_new = models.BooleanField(default=False)
    is_lost = models.BooleanField(default=False)

    # Source metrics
    source_rank = models.IntegerField(null=True, blank=True)
    source_spam_score = models.IntegerField(null=True, blank=True)

    first_seen = models.DateField(null=True, blank=True)
    last_seen = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-first_seen"]
        indexes = [
            models.Index(fields=["client", "-first_seen"]),
            models.Index(fields=["client", "source_domain"]),
        ]

    def __str__(self):
        return f"{self.source_domain} -> {self.target_url}"


class ReferringDomain(models.Model):
    """Referring domain summary."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="referring_domains")
    snapshot = models.ForeignKey(BacklinkSnapshot, on_delete=models.CASCADE, related_name="ref_domains", null=True, blank=True)

    domain = models.CharField(max_length=255, db_index=True)
    backlinks_count = models.IntegerField(default=0)
    dofollow_count = models.IntegerField(default=0)
    nofollow_count = models.IntegerField(default=0)
    rank = models.IntegerField(null=True, blank=True)
    spam_score = models.IntegerField(null=True, blank=True)
    first_seen = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-backlinks_count"]
        indexes = [models.Index(fields=["client", "-backlinks_count"])]

    def __str__(self):
        return f"{self.domain} ({self.backlinks_count} backlinks)"


class AnchorText(models.Model):
    """Anchor text distribution."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="anchor_texts")
    snapshot = models.ForeignKey(BacklinkSnapshot, on_delete=models.CASCADE, related_name="anchors", null=True, blank=True)

    anchor = models.CharField(max_length=1000, db_index=True)
    backlinks_count = models.IntegerField(default=0)
    referring_domains = models.IntegerField(default=0)
    dofollow = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-backlinks_count"]

    def __str__(self):
        return f'"{self.anchor}" ({self.backlinks_count} backlinks)'
