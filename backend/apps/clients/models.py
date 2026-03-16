from django.db import models


class Client(models.Model):
    # Identity
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    website_url = models.URLField(max_length=2048, blank=True)

    # Business details
    business_type = models.CharField(max_length=100, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    zip_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default="United States")

    # Google Business Profile
    google_business_name = models.CharField(max_length=255, blank=True)
    google_place_id = models.CharField(max_length=255, blank=True)
    google_cid = models.CharField(max_length=255, blank=True)

    # DataForSEO targeting defaults
    location_code = models.IntegerField(default=2840)
    location_name = models.CharField(max_length=255, default="United States")
    language_code = models.CharField(max_length=10, default="en")

    # Tracking configuration
    is_active = models.BooleanField(default=True)
    track_organic = models.BooleanField(default=True)
    track_maps = models.BooleanField(default=False)
    discovery_enabled = models.BooleanField(default=True)
    max_discovery_keywords = models.IntegerField(default=1000)

    # Notes & metadata
    notes = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    monthly_budget_usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.domain})"
