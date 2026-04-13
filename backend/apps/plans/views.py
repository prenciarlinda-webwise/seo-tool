from rest_framework import viewsets

from apps.clients.models import Client

from .models import Deliverable, PlanItem, QuarterlyPlan
from .serializers import (
    DeliverableSerializer,
    PlanItemSerializer,
    QuarterlyPlanListSerializer,
    QuarterlyPlanSerializer,
)


class QuarterlyPlanViewSet(viewsets.ModelViewSet):
    search_fields = ["name"]
    filterset_fields = ["status"]
    ordering_fields = ["quarter_start", "created_at"]

    def get_queryset(self):
        return QuarterlyPlan.objects.filter(
            client__slug=self.kwargs["client_slug"]
        ).prefetch_related("items__deliverables")

    def get_serializer_class(self):
        if self.action == "list":
            return QuarterlyPlanListSerializer
        return QuarterlyPlanSerializer

    def perform_create(self, serializer):
        client = Client.objects.get(slug=self.kwargs["client_slug"])
        serializer.save(client=client)


class PlanItemViewSet(viewsets.ModelViewSet):
    serializer_class = PlanItemSerializer
    search_fields = ["keyword_text", "title"]
    filterset_fields = ["category", "is_completed"]

    def get_queryset(self):
        return PlanItem.objects.filter(
            plan_id=self.kwargs["plan_pk"],
            plan__client__slug=self.kwargs["client_slug"],
        ).prefetch_related("deliverables")

    def perform_create(self, serializer):
        serializer.save(plan_id=self.kwargs["plan_pk"])


class DeliverableViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverableSerializer
    filterset_fields = ["status", "month"]

    def get_queryset(self):
        return Deliverable.objects.filter(
            plan_item_id=self.kwargs["item_pk"],
            plan_item__plan_id=self.kwargs["plan_pk"],
            plan_item__plan__client__slug=self.kwargs["client_slug"],
        )

    def perform_create(self, serializer):
        serializer.save(plan_item_id=self.kwargs["item_pk"])
