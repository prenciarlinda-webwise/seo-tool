from django.urls import path

from .views import GBPCallListView, GBPPerformanceListView, GBPReviewListView, GBPSearchKeywordListView

urlpatterns = [
    path("clients/<int:client_pk>/gbp/performance/", GBPPerformanceListView.as_view(), name="gbp-performance"),
    path("clients/<int:client_pk>/gbp/calls/", GBPCallListView.as_view(), name="gbp-calls"),
    path("clients/<int:client_pk>/gbp/reviews/", GBPReviewListView.as_view(), name="gbp-reviews"),
    path("clients/<int:client_pk>/gbp/search-keywords/", GBPSearchKeywordListView.as_view(), name="gbp-search-keywords"),
]
