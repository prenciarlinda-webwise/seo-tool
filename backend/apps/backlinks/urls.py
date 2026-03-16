from django.urls import path

from .views import (
    BacklinkSnapshotListView,
    BacklinkListView,
    ReferringDomainListView,
    AnchorTextListView,
    BacklinkSummaryView,
)

urlpatterns = [
    path("clients/<int:client_pk>/backlinks/summary/", BacklinkSummaryView.as_view(), name="backlink-summary"),
    path("clients/<int:client_pk>/backlinks/snapshots/", BacklinkSnapshotListView.as_view(), name="backlink-snapshots"),
    path("clients/<int:client_pk>/backlinks/links/", BacklinkListView.as_view(), name="backlink-links"),
    path("clients/<int:client_pk>/backlinks/referring-domains/", ReferringDomainListView.as_view(), name="backlink-referring-domains"),
    path("clients/<int:client_pk>/backlinks/anchors/", AnchorTextListView.as_view(), name="backlink-anchors"),
]
