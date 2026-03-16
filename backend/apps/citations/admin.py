from django.contrib import admin
from .models import Citation, CitationDirectory


@admin.register(CitationDirectory)
class CitationDirectoryAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "is_key_citation"]
    list_filter = ["is_key_citation", "category"]


@admin.register(Citation)
class CitationAdmin(admin.ModelAdmin):
    list_display = ["client", "directory", "status", "name_accurate", "address_accurate", "phone_accurate"]
    list_filter = ["status"]
    raw_id_fields = ["client", "directory"]
