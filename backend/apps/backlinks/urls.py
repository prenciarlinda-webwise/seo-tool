from django.urls import path

from .views import (
    BacklinkSnapshotListView,
    BacklinkListView,
    ReferringDomainListView,
    AnchorTextListView,
    BacklinkSummaryView,
)

urlpatterns = [
    path("clients/<slug:client_slug>/backlinks/summary/", BacklinkSummaryView.as_view(), name="backlink-summary"),
    path("clients/<slug:client_slug>/backlinks/snapshots/", BacklinkSnapshotListView.as_view(), name="backlink-snapshots"),
    path("clients/<slug:client_slug>/backlinks/links/", BacklinkListView.as_view(), name="backlink-links"),
    path("clients/<slug:client_slug>/backlinks/referring-domains/", ReferringDomainListView.as_view(), name="backlink-referring-domains"),
    path("clients/<slug:client_slug>/backlinks/anchors/", AnchorTextListView.as_view(), name="backlink-anchors"),
]
