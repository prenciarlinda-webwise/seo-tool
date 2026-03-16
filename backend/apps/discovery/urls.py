from django.urls import path

from .views import DiscoveryResultListView, DiscoveryRunListView, PromoteKeywordsView

urlpatterns = [
    path("clients/<int:client_pk>/discovery/runs/", DiscoveryRunListView.as_view(), name="discovery-runs"),
    path(
        "clients/<int:client_pk>/discovery/runs/<int:run_pk>/results/",
        DiscoveryResultListView.as_view(),
        name="discovery-results",
    ),
    path("clients/<int:client_pk>/discovery/promote/", PromoteKeywordsView.as_view(), name="discovery-promote"),
]
