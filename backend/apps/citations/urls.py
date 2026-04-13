from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .import_views import CitationExportView, CitationImportView
from .views import CitationCheckView, CitationDirectoryViewSet, CitationSummaryView, CitationViewSet

router = DefaultRouter()
router.register(r"citations", CitationViewSet, basename="citation")

dir_router = DefaultRouter()
dir_router.register(r"citation-directories", CitationDirectoryViewSet, basename="citation-directory")

urlpatterns = [
    path("clients/<slug:client_slug>/citations/summary/", CitationSummaryView.as_view(), name="citation-summary"),
    path("clients/<slug:client_slug>/citations/import/", CitationImportView.as_view(), name="citation-import"),
    path("clients/<slug:client_slug>/citations/export/", CitationExportView.as_view(), name="citation-export"),
    path("clients/<slug:client_slug>/citations/check/", CitationCheckView.as_view(), name="citation-check"),
    path("clients/<slug:client_slug>/", include(router.urls)),
    path("", include(dir_router.urls)),
]
