from django.urls import path

from .views import GBPCallListView, GBPPerformanceListView, GBPReviewListView, GBPSearchKeywordListView

urlpatterns = [
    path("clients/<slug:client_slug>/gbp/performance/", GBPPerformanceListView.as_view(), name="gbp-performance"),
    path("clients/<slug:client_slug>/gbp/calls/", GBPCallListView.as_view(), name="gbp-calls"),
    path("clients/<slug:client_slug>/gbp/reviews/", GBPReviewListView.as_view(), name="gbp-reviews"),
    path("clients/<slug:client_slug>/gbp/search-keywords/", GBPSearchKeywordListView.as_view(), name="gbp-search-keywords"),
]
