from django.contrib import admin

from .models import Deliverable, PlanItem, QuarterlyPlan


class DeliverableInline(admin.TabularInline):
    model = Deliverable
    extra = 0
    fields = ["title", "status", "due_date", "month", "assignee", "completed_at"]


class PlanItemInline(admin.TabularInline):
    model = PlanItem
    extra = 0
    raw_id_fields = ["keyword"]
    fields = [
        "category", "keyword_text", "title", "target_url", "target_rank", "priority",
        "month_0_rank", "month_1_rank", "month_2_rank", "month_3_rank",
        "is_completed",
    ]


@admin.register(QuarterlyPlan)
class QuarterlyPlanAdmin(admin.ModelAdmin):
    list_display = ["name", "client", "status", "quarter_start", "quarter_end"]
    list_filter = ["status"]
    raw_id_fields = ["client"]
    inlines = [PlanItemInline]


@admin.register(PlanItem)
class PlanItemAdmin(admin.ModelAdmin):
    list_display = ["__str__", "plan", "category", "target_rank", "is_completed"]
    list_filter = ["category", "is_completed", "plan__status"]
    raw_id_fields = ["plan", "keyword"]
    search_fields = ["keyword_text", "title"]
    inlines = [DeliverableInline]


@admin.register(Deliverable)
class DeliverableAdmin(admin.ModelAdmin):
    list_display = ["title", "plan_item", "status", "due_date", "month", "assignee"]
    list_filter = ["status", "month"]
    raw_id_fields = ["plan_item"]
    search_fields = ["title"]
