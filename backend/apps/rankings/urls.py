from django.urls import path

from .views import (
    CheckDatesView,
    LatestRankView,
    MapsRankListView,
    OrganicRankListView,
    RankChangesView,
    RankComparisonView,
)

urlpatterns = [
    path("clients/<int:client_pk>/rankings/organic/", OrganicRankListView.as_view(), name="rankings-organic"),
    path("clients/<int:client_pk>/rankings/maps/", MapsRankListView.as_view(), name="rankings-maps"),
    path("clients/<int:client_pk>/rankings/latest/", LatestRankView.as_view(), name="rankings-latest"),
    path("clients/<int:client_pk>/rankings/changes/", RankChangesView.as_view(), name="rankings-changes"),
    path("clients/<int:client_pk>/rankings/dates/", CheckDatesView.as_view(), name="rankings-dates"),
    path("clients/<int:client_pk>/rankings/compare/", RankComparisonView.as_view(), name="rankings-compare"),
]
