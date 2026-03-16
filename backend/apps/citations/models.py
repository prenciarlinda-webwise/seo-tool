from django.db import models


class CitationDirectory(models.Model):
    """A directory/platform where business can be listed."""
    name = models.CharField(max_length=255, unique=True)  # "Google", "Yelp", "BBB", etc
    url = models.URLField(max_length=2048, blank=True)
    category = models.CharField(max_length=50, blank=True)  # "major", "general", "industry"
    is_key_citation = models.BooleanField(default=False)  # Core directories
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_key_citation", "name"]
        verbose_name_plural = "Citation directories"

    def __str__(self):
        return self.name


class Citation(models.Model):
    """A client's listing on a directory."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="citations")
    directory = models.ForeignKey(CitationDirectory, on_delete=models.CASCADE, related_name="citations")

    # Status
    STATUS_CHOICES = [
        ("found", "Found"),
        ("not_found", "Not Found"),
        ("claimed", "Claimed"),
        ("unclaimed", "Unclaimed"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="not_found")
    listing_url = models.URLField(max_length=2048, blank=True)

    # NAP data found on listing
    listed_name = models.CharField(max_length=500, blank=True)
    listed_address = models.TextField(blank=True)
    listed_phone = models.CharField(max_length=50, blank=True)
    listed_zip = models.CharField(max_length=20, blank=True)

    # NAP accuracy flags
    name_accurate = models.BooleanField(null=True)
    address_accurate = models.BooleanField(null=True)
    phone_accurate = models.BooleanField(null=True)
    zip_accurate = models.BooleanField(null=True)

    # Last checked
    last_checked_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("client", "directory")]
        ordering = ["directory__name"]
        indexes = [
            models.Index(fields=["client", "status"]),
        ]

    def __str__(self):
        return f"{self.client.domain} on {self.directory.name}: {self.status}"

    @property
    def nap_errors(self):
        errors = 0
        for field in [self.name_accurate, self.address_accurate, self.phone_accurate, self.zip_accurate]:
            if field is False:
                errors += 1
        return errors
