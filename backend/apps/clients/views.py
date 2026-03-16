from datetime import timedelta

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.keywords.models import KeywordStatus
from apps.rankings.models import LocalFinderResult, MapsRankResult, SERPResult

from .models import Client
from .serializers import ClientListSerializer, ClientSerializer


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    search_fields = ["name", "domain"]
    filterset_fields = ["is_active", "track_organic", "track_maps"]
    ordering_fields = ["name", "domain", "created_at"]

    def get_queryset(self):
        qs = Client.objects.all()
        if self.action == "list":
            # Single query with all annotations — no N+1
            from django.db.models import Avg, Count, Q, Subquery, OuterRef
            from apps.analytics.models import GA4TrafficSnapshot

            latest_traffic = (
                GA4TrafficSnapshot.objects.filter(client=OuterRef("pk"))
                .order_by("-date")
                .values("organic_sessions")[:1]
            )

            qs = qs.annotate(
                tracked_keywords_count=Count(
                    "keywords", filter=Q(keywords__status="tracked")
                ),
                discovered_keywords_count=Count(
                    "keywords", filter=Q(keywords__status="discovered")
                ),
                rankings_up=Count(
                    "keywords",
                    filter=Q(keywords__status="tracked", keywords__rank_change__gt=0),
                ),
                rankings_down=Count(
                    "keywords",
                    filter=Q(keywords__status="tracked", keywords__rank_change__lt=0),
                ),
                rankings_new=Count(
                    "keywords",
                    filter=Q(
                        keywords__status="tracked",
                        keywords__current_organic_rank__isnull=False,
                        keywords__previous_organic_rank__isnull=True,
                    ),
                ),
                avg_position=Avg(
                    "keywords__current_organic_rank",
                    filter=Q(
                        keywords__status="tracked",
                        keywords__current_organic_rank__isnull=False,
                    ),
                ),
                organic_sessions=Subquery(latest_traffic),
            )
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ClientListSerializer
        return ClientSerializer

    def perform_create(self, serializer):
        """After creating a client, trigger initial data sync."""
        client = serializer.save()
        self._trigger_initial_sync(client)

    def _trigger_initial_sync(self, client):
        """Kick off discovery + rank tracking for a new client."""
        from apps.discovery.tasks import monthly_keyword_discovery
        from apps.citations.tasks import check_citations_for_client

        # Discovery first — finds keywords the client ranks for
        if client.discovery_enabled:
            monthly_keyword_discovery.delay()

        # Check citations if any exist
        if client.citations.exists():
            check_citations_for_client.delay(client.id)

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        """Manually trigger a full data sync for a client."""
        client = self.get_object()
        from apps.discovery.tasks import monthly_keyword_discovery
        from apps.rankings.tasks import weekly_rank_tracking
        from apps.citations.tasks import check_citations_for_client

        triggered = []

        if client.discovery_enabled:
            monthly_keyword_discovery.delay()
            triggered.append("discovery")

        if client.is_active:
            weekly_rank_tracking.delay()
            triggered.append("rank_tracking")

        if client.citations.exists():
            check_citations_for_client.delay(client.id)
            triggered.append("citations")

        return Response({
            "message": f"Sync triggered for {client.name}",
            "tasks": triggered,
        })

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        client = self.get_object()
        keywords = client.keywords.all()
        tracked = keywords.filter(status=KeywordStatus.TRACKED)
        today = timezone.now().date()
        thirty_days_ago = today - timedelta(days=30)

        last_discovery = (
            client.discovery_runs.filter(status="completed")
            .values_list("run_date", flat=True).first()
        )

        total_tracked = tracked.count()

        # --- Per-type ranking summaries ---
        def _type_summary(ranked_qs, rank_field, history_qs, history_rank_field, top_ns=None):
            if top_ns is None:
                top_ns = [3, 10, 20, 50]

            non_null = ranked_qs.exclude(**{f"{rank_field}__isnull": True})
            found = non_null.count()
            avg = non_null.aggregate(a=Avg(rank_field))["a"]
            improved = non_null.filter(rank_change__gt=0).count()
            declined = non_null.filter(rank_change__lt=0).count()

            result = {
                "found": found,
                "not_found": total_tracked - found,
                "avg_rank": round(avg, 1) if avg else None,
                "improved": improved,
                "declined": declined,
            }
            for n in top_ns:
                result[f"in_top_{n}"] = non_null.filter(**{f"{rank_field}__lte": n}).count()

            # Position history
            result["history"] = [
                {"date": str(r["checked_at"]), "avg_rank": round(r["avg_rank"], 1)}
                for r in history_qs.filter(is_found=True)
                .values("checked_at")
                .annotate(avg_rank=Avg(history_rank_field))
                .order_by("checked_at")[:30]
            ]

            return result

        desktop_summary = _type_summary(
            tracked, "current_organic_rank",
            SERPResult.objects.filter(client=client), "rank_absolute",
            top_ns=[3, 10, 20, 50],
        )

        # Maps = Local Pack
        maps_ranked = tracked.filter(current_maps_rank__isnull=False)
        maps_summary = {
            "found": maps_ranked.count(),
            "not_found": total_tracked - maps_ranked.count(),
            "avg_rank": None,
            "improved": 0,
            "declined": 0,
            "in_top_3": maps_ranked.filter(current_maps_rank__lte=3).count(),
            "coverage_pct": round(
                (maps_ranked.count() / total_tracked * 100) if total_tracked > 0 else 0, 1
            ),
            "history": [
                {"date": str(r["checked_at"]), "avg_rank": round(r["avg_rank"], 1)}
                for r in MapsRankResult.objects.filter(client=client, is_found=True)
                .values("checked_at")
                .annotate(avg_rank=Avg("rank_group"))
                .order_by("checked_at")[:30]
            ],
        }
        maps_avg = maps_ranked.aggregate(a=Avg("current_maps_rank"))["a"]
        if maps_avg:
            maps_summary["avg_rank"] = round(maps_avg, 1)

        # Local Finder
        finder_summary = {
            "found": 0, "not_found": total_tracked, "avg_rank": None,
            "improved": 0, "declined": 0, "in_top_3": 0, "in_top_10": 0, "in_top_20": 0,
            "history": [
                {"date": str(r["checked_at"]), "avg_rank": round(r["avg_rank"], 1)}
                for r in LocalFinderResult.objects.filter(client=client, is_found=True)
                .values("checked_at")
                .annotate(avg_rank=Avg("rank"))
                .order_by("checked_at")[:30]
            ],
        }
        # Get latest finder data
        latest_finder_date = (
            LocalFinderResult.objects.filter(client=client)
            .values_list("checked_at", flat=True).order_by("-checked_at").first()
        )
        if latest_finder_date:
            finder_latest = LocalFinderResult.objects.filter(
                client=client, checked_at=latest_finder_date, is_found=True
            )
            finder_summary["found"] = finder_latest.count()
            finder_summary["not_found"] = total_tracked - finder_latest.count()
            f_avg = finder_latest.aggregate(a=Avg("rank"))["a"]
            if f_avg:
                finder_summary["avg_rank"] = round(f_avg, 1)
            finder_summary["in_top_3"] = finder_latest.filter(rank__lte=3).count()
            finder_summary["in_top_10"] = finder_latest.filter(rank__lte=10).count()
            finder_summary["in_top_20"] = finder_latest.filter(rank__lte=20).count()

        # Mobile placeholder (same structure, no data yet)
        mobile_summary = {
            "found": 0, "not_found": total_tracked, "avg_rank": None,
            "improved": 0, "declined": 0,
            "in_top_3": 0, "in_top_10": 0, "in_top_20": 0, "in_top_50": 0,
            "history": [],
        }

        # --- GBP ---
        latest_review = client.gbp_reviews.order_by("-date").first()
        reviews_data = None
        if latest_review:
            reviews_data = {
                "total_reviews": latest_review.total_reviews,
                "average_rating": latest_review.average_rating,
                "new_reviews_since_last": latest_review.new_reviews_since_last,
                "response_rate": latest_review.response_rate,
                "five_star": latest_review.five_star,
                "four_star": latest_review.four_star,
                "three_star": latest_review.three_star,
                "two_star": latest_review.two_star,
                "one_star": latest_review.one_star,
            }

        gbp_totals = client.gbp_performance.filter(date__gte=thirty_days_ago).aggregate(
            impressions=Sum("total_impressions"),
            interactions=Sum("total_interactions"),
            call_clicks=Sum("call_clicks"),
            website_clicks=Sum("website_clicks"),
            direction_requests=Sum("direction_requests"),
        )

        # --- GA4 ---
        ga4_traffic_history = list(
            client.ga4_traffic.filter(date__gte=thirty_days_ago)
            .order_by("date")
            .values("date", "organic_sessions", "organic_users", "total_sessions")
        )
        ga4_totals = client.ga4_traffic.filter(date__gte=thirty_days_ago).aggregate(
            sessions=Sum("organic_sessions"),
            users=Sum("organic_users"),
            total_sessions=Sum("total_sessions"),
        )
        conv_totals = client.ga4_conversion_summaries.filter(
            date__gte=thirty_days_ago
        ).aggregate(
            total=Sum("total_conversions"),
            organic=Sum("organic_conversions"),
        )

        # --- Citations summary ---
        citations_count = client.citations.count()
        citations_found = client.citations.filter(status__in=["found", "claimed"]).count()
        citation_nap_errors = 0
        for c in client.citations.all():
            citation_nap_errors += c.nap_errors

        # --- Plans summary ---
        active_plan = client.plans.filter(status="active").first()
        plan_data = None
        if active_plan:
            items = active_plan.items.all()
            plan_data = {
                "id": active_plan.id,
                "name": active_plan.name,
                "progress_pct": active_plan.progress_pct,
                "total_items": items.count(),
                "completed_items": sum(1 for i in items if i.is_target_achieved),
            }

        data = {
            "client": ClientSerializer(client).data,
            "total_tracked_keywords": total_tracked,
            "total_discovered_keywords": keywords.filter(status=KeywordStatus.DISCOVERED).count(),
            "last_discovery_run": last_discovery,
            "last_rank_check": (
                tracked.filter(last_checked_at__isnull=False)
                .values_list("last_checked_at", flat=True).first()
            ),
            # Per-type ranking summaries
            "rankings": {
                "desktop": desktop_summary,
                "mobile": mobile_summary,
                "local_pack": maps_summary,
                "local_finder": finder_summary,
            },
            # GBP
            "reviews": reviews_data,
            "gbp_totals": {k: v or 0 for k, v in gbp_totals.items()},
            # GA4
            "ga4_traffic_history": [
                {"date": str(r["date"]), "organic_sessions": r["organic_sessions"], "organic_users": r["organic_users"]}
                for r in ga4_traffic_history
            ],
            "ga4_totals": {k: v or 0 for k, v in ga4_totals.items()},
            "ga4_conversions": {k: v or 0 for k, v in conv_totals.items()},
            # Citations
            "citations": {
                "total": citations_count,
                "found": citations_found,
                "nap_errors": citation_nap_errors,
            },
            # Active plan
            "active_plan": plan_data,
        }

        return Response(data)
