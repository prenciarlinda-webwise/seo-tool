from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .import_views import PlanItemExportView, PlanItemImportView
from .views import DeliverableViewSet, PlanItemViewSet, QuarterlyPlanViewSet

plan_router = DefaultRouter()
plan_router.register(r"plans", QuarterlyPlanViewSet, basename="plan")

item_router = DefaultRouter()
item_router.register(r"items", PlanItemViewSet, basename="plan-item")

deliverable_router = DefaultRouter()
deliverable_router.register(r"deliverables", DeliverableViewSet, basename="deliverable")

urlpatterns = [
    path("clients/<slug:client_slug>/", include(plan_router.urls)),
    path("clients/<slug:client_slug>/plans/<int:plan_pk>/items/import/", PlanItemImportView.as_view(), name="plan-item-import"),
    path("clients/<slug:client_slug>/plans/<int:plan_pk>/items/export/", PlanItemExportView.as_view(), name="plan-item-export"),
    path("clients/<slug:client_slug>/plans/<int:plan_pk>/", include(item_router.urls)),
    path("clients/<slug:client_slug>/plans/<int:plan_pk>/items/<int:item_pk>/", include(deliverable_router.urls)),
]
