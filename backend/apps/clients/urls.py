from django.urls import path
from rest_framework.routers import DefaultRouter

from .import_views import ClientExportView, ClientImportView
from .views import ClientViewSet

router = DefaultRouter()
router.register(r"clients", ClientViewSet)

urlpatterns = router.urls + [
    path("clients/import/", ClientImportView.as_view(), name="client-import"),
    path("clients/export/", ClientExportView.as_view(), name="client-export"),
]
