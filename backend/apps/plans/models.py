from django.db import models


class PlanStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    ARCHIVED = "archived", "Archived"


class ItemCategory(models.TextChoices):
    ON_PAGE = "on_page", "On-Page SEO"
    GMB = "gmb", "Google Business Profile"
    CITATIONS = "citations", "Citations"
    CONTENT = "content", "Content"
    LINK_BUILDING = "link_building", "Link Building"
    TECHNICAL = "technical", "Technical SEO"


class QuarterlyPlan(models.Model):
    """A single 3-month SEO plan for a client. Contains items across all categories."""
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="plans")

    name = models.CharField(max_length=255)                          # "Q2 2026 SEO Plan"
    status = models.CharField(max_length=20, choices=PlanStatus.choices, default=PlanStatus.DRAFT)

    # Quarter
    quarter_start = models.DateField()
    quarter_end = models.DateField()

    # Month labels
    month_0_label = models.CharField(max_length=20, blank=True)      # "Baseline (Mar)"
    month_1_label = models.CharField(max_length=20, blank=True)      # "Apr 2026"
    month_2_label = models.CharField(max_length=20, blank=True)      # "May 2026"
    month_3_label = models.CharField(max_length=20, blank=True)      # "Jun 2026"

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-quarter_start"]
        indexes = [
            models.Index(fields=["client", "-quarter_start"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.client.name})"

    @property
    def progress_pct(self):
        items = self.items.all()
        if not items:
            return 0
        achieved = sum(1 for i in items if i.is_target_achieved)
        return round((achieved / len(items)) * 100)


class PlanItem(models.Model):
    """One action item in a quarterly plan, tagged with a category."""
    plan = models.ForeignKey(QuarterlyPlan, on_delete=models.CASCADE, related_name="items")
    category = models.CharField(max_length=20, choices=ItemCategory.choices, default=ItemCategory.ON_PAGE)

    # Link to tracked keyword (optional — citations/technical items may not have one)
    keyword = models.ForeignKey(
        "keywords.Keyword", on_delete=models.SET_NULL, related_name="plan_items",
        null=True, blank=True,
    )
    keyword_text = models.CharField(max_length=500, blank=True)      # Denormalized / free text for non-keyword items

    # Target URL
    target_url = models.URLField(max_length=2048, blank=True)

    # Target rank (for on_page / gmb categories)
    target_rank = models.IntegerField(null=True, blank=True)

    # Monthly rank snapshots
    month_0_rank = models.IntegerField(null=True, blank=True)
    month_1_rank = models.IntegerField(null=True, blank=True)
    month_2_rank = models.IntegerField(null=True, blank=True)
    month_3_rank = models.IntegerField(null=True, blank=True)

    # Monthly traffic snapshots
    month_0_traffic = models.FloatField(null=True, blank=True)
    month_1_traffic = models.FloatField(null=True, blank=True)
    month_2_traffic = models.FloatField(null=True, blank=True)
    month_3_traffic = models.FloatField(null=True, blank=True)

    # Search metrics
    search_volume = models.IntegerField(null=True, blank=True)
    keyword_difficulty = models.IntegerField(null=True, blank=True)

    # For citations category
    citation_source = models.CharField(max_length=255, blank=True)   # "Yelp", "BBB", etc
    citation_status = models.CharField(max_length=20, blank=True)    # "found", "not_found", "nap_error"

    # For content category
    content_title = models.CharField(max_length=500, blank=True)     # Blog post title, etc
    content_status = models.CharField(max_length=20, blank=True)     # "planned", "writing", "published"
    publish_url = models.URLField(max_length=2048, blank=True)

    # For link building category
    link_target_domain = models.CharField(max_length=255, blank=True)
    link_status = models.CharField(max_length=20, blank=True)        # "prospecting", "outreach", "acquired", "rejected"

    # General
    title = models.CharField(max_length=500, blank=True)             # Human-readable task description
    priority = models.IntegerField(default=0)
    notes = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "-priority", "keyword_text"]
        indexes = [
            models.Index(fields=["plan", "category"]),
            models.Index(fields=["plan", "-priority"]),
        ]

    def __str__(self):
        if self.title:
            return self.title
        if self.keyword_text:
            return f"{self.keyword_text} → {self.target_url or 'TBD'}"
        return f"{self.get_category_display()} item"

    @property
    def current_rank(self):
        for r in [self.month_3_rank, self.month_2_rank, self.month_1_rank, self.month_0_rank]:
            if r is not None:
                return r
        return None

    @property
    def rank_improvement(self):
        current = self.current_rank
        if current is not None and self.month_0_rank is not None:
            return self.month_0_rank - current
        return None

    @property
    def is_target_achieved(self):
        current = self.current_rank
        if current is not None and self.target_rank is not None:
            return current <= self.target_rank
        return self.is_completed

    @property
    def deliverables_done(self):
        total = self.deliverables.count()
        if total == 0:
            return None
        done = self.deliverables.filter(status="done").count()
        return f"{done}/{total}"


class DeliverableStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In Progress"
    DONE = "done", "Done"
    BLOCKED = "blocked", "Blocked"


class Deliverable(models.Model):
    """A specific task/action to achieve a plan item's goal."""
    plan_item = models.ForeignKey(PlanItem, on_delete=models.CASCADE, related_name="deliverables")

    title = models.CharField(max_length=500)                         # "Publish GMB post about emergency services"
    description = models.TextField(blank=True)                       # Details, CTA text, etc.
    status = models.CharField(max_length=20, choices=DeliverableStatus.choices, default=DeliverableStatus.PENDING)

    # Scheduling
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateField(null=True, blank=True)
    month = models.IntegerField(null=True, blank=True)               # 1, 2, or 3 — which month of the quarter

    # For GMB-specific deliverables
    gmb_post_type = models.CharField(max_length=50, blank=True)      # "update", "offer", "event"
    gmb_post_cta = models.CharField(max_length=100, blank=True)      # "Call now", "Learn more", "Book"
    gmb_post_image_url = models.URLField(max_length=2048, blank=True)

    # For on-page deliverables
    on_page_action = models.CharField(max_length=100, blank=True)    # "optimize_h1", "add_schema", "internal_links", "meta_update"

    # Assignee (free text for now)
    assignee = models.CharField(max_length=255, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "created_at"]
        indexes = [
            models.Index(fields=["plan_item", "status"]),
            models.Index(fields=["plan_item", "due_date"]),
        ]

    def __str__(self):
        return self.title
