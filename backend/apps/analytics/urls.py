from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    GA4ConversionSummaryListView,
    GA4EventListView,
    GA4LandingPageListView,
    GA4PropertyViewSet,
    GA4TrafficListView,
)

router = DefaultRouter()
router.register(r"ga4-properties", GA4PropertyViewSet, basename="ga4-property")

urlpatterns = [
    path("clients/<int:client_pk>/", include(router.urls)),
    path("clients/<int:client_pk>/analytics/traffic/", GA4TrafficListView.as_view(), name="ga4-traffic"),
    path("clients/<int:client_pk>/analytics/landing-pages/", GA4LandingPageListView.as_view(), name="ga4-landing-pages"),
    path("clients/<int:client_pk>/analytics/events/", GA4EventListView.as_view(), name="ga4-events"),
    path("clients/<int:client_pk>/analytics/conversions/", GA4ConversionSummaryListView.as_view(), name="ga4-conversions"),
]
