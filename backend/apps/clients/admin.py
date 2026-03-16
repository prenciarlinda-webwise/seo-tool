from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["name", "domain", "is_active", "track_organic", "track_maps", "discovery_enabled"]
    list_filter = ["is_active", "track_organic", "track_maps", "discovery_enabled"]
    search_fields = ["name", "domain"]
