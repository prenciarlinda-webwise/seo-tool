from django.urls import path

from .views import (
    CheckDatesView,
    CompetitorRankingsView,
    LatestRankView,
    LocalFinderListView,
    MapsRankListView,
    OrganicRankListView,
    RankChangesView,
    RankComparisonView,
)

urlpatterns = [
    path("clients/<slug:client_slug>/rankings/organic/", OrganicRankListView.as_view(), name="rankings-organic"),
    path("clients/<slug:client_slug>/rankings/maps/", MapsRankListView.as_view(), name="rankings-maps"),
    path("clients/<slug:client_slug>/rankings/local-finder/", LocalFinderListView.as_view(), name="rankings-local-finder"),
    path("clients/<slug:client_slug>/rankings/latest/", LatestRankView.as_view(), name="rankings-latest"),
    path("clients/<slug:client_slug>/rankings/changes/", RankChangesView.as_view(), name="rankings-changes"),
    path("clients/<slug:client_slug>/rankings/dates/", CheckDatesView.as_view(), name="rankings-dates"),
    path("clients/<slug:client_slug>/rankings/compare/", RankComparisonView.as_view(), name="rankings-compare"),
    path("clients/<slug:client_slug>/rankings/competitors/", CompetitorRankingsView.as_view(), name="rankings-competitors"),
]
