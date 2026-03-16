from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .import_views import CitationExportView, CitationImportView
from .views import CitationCheckView, CitationDirectoryViewSet, CitationSummaryView, CitationViewSet

router = DefaultRouter()
router.register(r"citations", CitationViewSet, basename="citation")

dir_router = DefaultRouter()
dir_router.register(r"citation-directories", CitationDirectoryViewSet, basename="citation-directory")

urlpatterns = [
    path("clients/<int:client_pk>/citations/summary/", CitationSummaryView.as_view(), name="citation-summary"),
    path("clients/<int:client_pk>/citations/import/", CitationImportView.as_view(), name="citation-import"),
    path("clients/<int:client_pk>/citations/export/", CitationExportView.as_view(), name="citation-export"),
    path("clients/<int:client_pk>/citations/check/", CitationCheckView.as_view(), name="citation-check"),
    path("clients/<int:client_pk>/", include(router.urls)),
    path("", include(dir_router.urls)),
]
