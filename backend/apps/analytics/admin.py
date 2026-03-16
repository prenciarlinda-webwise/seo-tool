from django.contrib import admin

from .models import GA4ConversionSummary, GA4Event, GA4LandingPage, GA4Property, GA4TrafficSnapshot


@admin.register(GA4Property)
class GA4PropertyAdmin(admin.ModelAdmin):
    list_display = ["property_id", "property_name", "client", "measurement_id", "gtm_container_id", "is_active"]
    list_filter = ["is_active"]
    raw_id_fields = ["client"]


@admin.register(GA4TrafficSnapshot)
class GA4TrafficSnapshotAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "organic_sessions", "organic_users", "total_sessions", "organic_bounce_rate"]
    list_filter = ["date"]
    raw_id_fields = ["client", "ga4_property"]
    date_hierarchy = "date"


@admin.register(GA4LandingPage)
class GA4LandingPageAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "page_path", "organic_sessions", "organic_users"]
    search_fields = ["page_path"]
    raw_id_fields = ["client", "ga4_property"]
    date_hierarchy = "date"


@admin.register(GA4Event)
class GA4EventAdmin(admin.ModelAdmin):
    list_display = ["client", "date", "event_name", "event_count", "organic_event_count", "is_conversion"]
    list_filter = ["is_conversion", "is_key_event", "event_name"]
    raw_id_fields = ["client", "ga4_property"]
    date_hierarchy = "date"


@admin.register(GA4ConversionSummary)
class GA4ConversionSummaryAdmin(admin.ModelAdmin):
    list_display = [
        "client", "date", "total_conversions", "organic_conversions",
        "form_submissions", "phone_clicks", "organic_conversion_rate",
    ]
    raw_id_fields = ["client", "ga4_property"]
    date_hierarchy = "date"
