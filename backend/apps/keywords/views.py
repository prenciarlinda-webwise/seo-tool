from collections import defaultdict

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Keyword, KeywordStatus
from .serializers import BulkStatusSerializer, KeywordSerializer


class KeywordViewSet(viewsets.ModelViewSet):
    serializer_class = KeywordSerializer
    search_fields = ["keyword_text", "group_name"]
    filterset_fields = ["status", "is_branded", "is_primary", "maps_enabled", "intent"]
    ordering_fields = [
        "keyword_text", "search_volume", "current_organic_rank",
        "current_maps_rank", "rank_change", "created_at",
    ]

    def get_queryset(self):
        return Keyword.objects.filter(
            client_id=self.kwargs["client_pk"]
        ).prefetch_related("tags")

    def perform_create(self, serializer):
        serializer.save(client_id=self.kwargs["client_pk"])

    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request, client_pk=None):
        serializer = BulkStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keyword_ids = serializer.validated_data["keyword_ids"]
        new_status = serializer.validated_data["status"]

        update_fields = {"status": new_status, "updated_at": timezone.now()}
        if new_status == KeywordStatus.TRACKED:
            update_fields["promoted_at"] = timezone.now()

        updated = Keyword.objects.filter(
            client_id=client_pk,
            id__in=keyword_ids,
        ).update(**update_fields)

        return Response({"updated": updated})


class PagesView(APIView):
    """URL-centric view: group tracked keywords by their ranking URL.
    Includes traffic estimates and plan references."""

    def get(self, request, client_pk):
        from apps.plans.models import PlanItem, QuarterlyPlan

        keywords = Keyword.objects.filter(
            client_id=client_pk,
            status=KeywordStatus.TRACKED,
            current_organic_url__gt="",
        ).order_by("current_organic_url")

        # Get active plan items for this client, indexed by keyword_id
        active_plans = QuarterlyPlan.objects.filter(
            client_id=client_pk,
            status__in=["active", "draft"],
        )
        plan_items_by_kw = {}
        plan_items_by_url = defaultdict(list)
        for plan in active_plans:
            for item in plan.items.all():
                if item.keyword_id:
                    plan_items_by_kw[item.keyword_id] = {
                        "plan_id": plan.id,
                        "plan_name": plan.name,
                        "target_rank": item.target_rank,
                        "is_completed": item.is_completed,
                    }
                if item.target_url:
                    plan_items_by_url[item.target_url].append(item.keyword_text)

        # Group by URL
        url_map = defaultdict(list)
        for kw in keywords:
            url_map[kw.current_organic_url].append(kw)

        pages = []
        for url, kws in sorted(url_map.items(), key=lambda x: -len(x[1])):
            ranks = [kw.current_organic_rank for kw in kws if kw.current_organic_rank is not None]
            volumes = [kw.search_volume for kw in kws if kw.search_volume is not None]
            changes = [kw.rank_change for kw in kws if kw.rank_change is not None]
            traffics = [kw.estimated_traffic for kw in kws if kw.estimated_traffic is not None]

            # Check if any keyword for this URL is in an active plan
            in_plan = any(kw.id in plan_items_by_kw for kw in kws)
            plan_keywords_count = sum(1 for kw in kws if kw.id in plan_items_by_kw)

            pages.append({
                "url": url,
                "total_keywords": len(kws),
                "avg_position": round(sum(ranks) / len(ranks), 1) if ranks else None,
                "best_position": min(ranks) if ranks else None,
                "total_volume": sum(volumes) if volumes else 0,
                "total_traffic": round(sum(traffics), 1) if traffics else None,
                "keywords_improved": sum(1 for c in changes if c > 0),
                "keywords_declined": sum(1 for c in changes if c < 0),
                "in_plan": in_plan,
                "plan_keywords_count": plan_keywords_count,
                "keywords": [
                    {
                        "keyword_id": kw.id,
                        "keyword_text": kw.keyword_text,
                        "rank": kw.current_organic_rank,
                        "rank_change": kw.rank_change,
                        "search_volume": kw.search_volume,
                        "maps_rank": kw.current_maps_rank,
                        "estimated_traffic": kw.estimated_traffic,
                        "in_plan": kw.id in plan_items_by_kw,
                        "plan_target_rank": (
                            plan_items_by_kw[kw.id]["target_rank"]
                            if kw.id in plan_items_by_kw
                            else None
                        ),
                    }
                    for kw in sorted(kws, key=lambda k: k.current_organic_rank or 999)
                ],
            })

        # Compute totals
        all_traffic = sum(p["total_traffic"] or 0 for p in pages)

        return Response({
            "pages": pages,
            "total_pages": len(pages),
            "total_traffic": round(all_traffic, 1),
        })
