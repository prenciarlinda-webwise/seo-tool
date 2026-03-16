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
        """Full data sync: discovery → auto-promote → competitors → ranks → citations."""
        client = self.get_object()
        from apps.discovery.tasks import _discover_keywords_for_client
        from apps.rankings.tasks import _check_keyword_rankings
        from apps.citations.tasks import check_citations_for_client
        from apps.keywords.models import Keyword
        from apps.competitors.models import Competitor
        from django.conf import settings
        from services.dataforseo import DataForSEOClient, SERPService, MapsService, LabsService
        from datetime import date
        from django.utils import timezone
        import logging

        logger = logging.getLogger(__name__)
        results = {}

        try:
            api_client = DataForSEOClient(
                login=settings.DATAFORSEO_LOGIN,
                password=settings.DATAFORSEO_PASSWORD,
            )
        except Exception as e:
            return Response({"error": f"DataForSEO connection failed: {e}"}, status=500)

        # 1. Discovery — find keywords this domain ranks for
        if client.discovery_enabled:
            try:
                disc = _discover_keywords_for_client(client)
                results["discovery"] = disc
            except Exception as e:
                logger.exception("Discovery failed for %s", client.domain)
                results["discovery"] = {"error": str(e)}

        # 2. Auto-promote keywords: top 50 with volume >= 50
        auto_promoted = 0
        discovered = Keyword.objects.filter(
            client=client, status="discovered",
        )
        for kw in discovered:
            if (
                kw.search_volume and kw.search_volume >= 50
                and kw.discovery_rank and kw.discovery_rank <= 50
            ):
                kw.status = "tracked"
                kw.promoted_at = timezone.now()
                kw.save(update_fields=["status", "promoted_at", "updated_at"])
                auto_promoted += 1
        results["auto_promoted"] = auto_promoted

        # 3. Discover competitors
        try:
            labs = LabsService(api_client)
            comp_result = labs.get_competitors_domain(
                client.domain, location_code=client.location_code, limit=10,
            )
            comp_created = 0
            for item in comp_result.get("items", []):
                domain = item.get("domain", "")
                if domain and domain != client.domain:
                    _, created = Competitor.objects.get_or_create(
                        client=client, domain=domain,
                        defaults={"name": domain, "is_auto_discovered": True},
                    )
                    if created:
                        comp_created += 1
            results["competitors_found"] = comp_created
        except Exception as e:
            logger.exception("Competitor discovery failed for %s", client.domain)
            results["competitors_found"] = {"error": str(e)}

        # 4. Rank tracking for all tracked keywords
        if client.is_active:
            try:
                serp = SERPService(api_client)
                maps = MapsService(api_client)
                today = date.today()
                tracked = Keyword.objects.filter(client=client, status="tracked")
                checked = 0
                for kw in tracked:
                    try:
                        _check_keyword_rankings(kw, client, today, serp, maps)
                        checked += 1
                    except Exception:
                        logger.exception("Rank check failed: %s", kw.keyword_text)
                results["rank_tracking"] = {"checked": checked}
            except Exception as e:
                logger.exception("Rank tracking failed for %s", client.domain)
                results["rank_tracking"] = {"error": str(e)}

        # 5. Citations
        if client.citations.exists():
            try:
                check_citations_for_client(client.id)
                results["citations"] = "checked"
            except Exception as e:
                results["citations"] = {"error": str(e)}

        return Response({
            "message": f"Sync complete for {client.name}",
            "results": results,
        })

    @action(detail=True, methods=["post"], url_path="run-discovery")
    def run_discovery(self, request, pk=None):
        """Run keyword discovery for this client."""
        client = self.get_object()
        from apps.discovery.tasks import _discover_keywords_for_client
        try:
            result = _discover_keywords_for_client(client)
            return Response({"message": "Discovery complete", "result": result})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=True, methods=["post"], url_path="run-ranks")
    def run_ranks(self, request, pk=None):
        """Run rank tracking for this client."""
        client = self.get_object()
        from apps.rankings.tasks import _check_keyword_rankings
        from apps.keywords.models import Keyword
        from services.dataforseo import DataForSEOClient, SERPService, MapsService
        from django.conf import settings
        from datetime import date

        api = DataForSEOClient(settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
        serp, maps = SERPService(api), MapsService(api)
        tracked = Keyword.objects.filter(client=client, status="tracked")
        checked, failed = 0, 0
        for kw in tracked:
            try:
                _check_keyword_rankings(kw, client, date.today(), serp, maps)
                checked += 1
            except Exception:
                failed += 1
        return Response({"message": f"Checked {checked}, failed {failed}"})

    @action(detail=True, methods=["post"], url_path="run-backlinks")
    def run_backlinks(self, request, pk=None):
        """Pull backlink profile for this client."""
        client = self.get_object()
        from services.dataforseo import DataForSEOClient, BacklinksService
        from apps.backlinks.models import BacklinkSnapshot, Backlink, ReferringDomain, AnchorText
        from django.conf import settings
        from datetime import date

        api = DataForSEOClient(settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
        bl = BacklinksService(api)

        summary = bl.get_summary(client.domain)
        snap = BacklinkSnapshot.objects.create(
            client=client, date=date.today(),
            total_backlinks=summary.get("total_backlinks", 0),
            referring_domains=summary.get("referring_domains", 0),
            referring_ips=summary.get("referring_ips", 0),
            broken_backlinks=summary.get("broken_backlinks", 0),
            broken_pages=summary.get("broken_pages", 0),
            dofollow=summary.get("dofollow", 0),
            nofollow=summary.get("nofollow", 0),
            rank=summary.get("rank"),
        )

        links = bl.get_backlinks(client.domain, limit=100)
        for item in links.get("items", []):
            Backlink.objects.create(
                client=client, snapshot=snap,
                source_url=item.get("url_from", ""),
                source_domain=item.get("domain_from", ""),
                target_url=item.get("url_to", ""),
                anchor=item.get("anchor", ""),
                is_dofollow=item.get("dofollow", True),
                source_rank=item.get("rank"),
                first_seen=item.get("first_seen"),
                last_seen=item.get("last_seen"),
            )

        domains = bl.get_referring_domains(client.domain, limit=100)
        for item in domains.get("items", []):
            ReferringDomain.objects.create(
                client=client, snapshot=snap,
                domain=item.get("domain", ""),
                backlinks_count=item.get("backlinks", 0),
                dofollow_count=item.get("dofollow", 0),
                nofollow_count=item.get("nofollow", 0),
                rank=item.get("rank"),
            )

        anchors = bl.get_anchors(client.domain, limit=100)
        for item in anchors.get("items", []):
            AnchorText.objects.create(
                client=client, snapshot=snap,
                anchor=item.get("anchor", ""),
                backlinks_count=item.get("backlinks", 0),
                referring_domains=item.get("referring_domains", 0),
                dofollow=item.get("dofollow", 0),
            )

        return Response({
            "message": f"Backlinks pulled: {snap.total_backlinks} links, {snap.referring_domains} domains",
        })

    @action(detail=True, methods=["post"], url_path="run-audit")
    def run_audit(self, request, pk=None):
        """Start a site audit crawl."""
        client = self.get_object()
        from services.dataforseo import DataForSEOClient, OnPageService
        from apps.onpage.models import SiteAudit
        from django.conf import settings

        api = DataForSEOClient(settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
        op = OnPageService(api)
        url = client.website_url or f"https://{client.domain}"

        task_id = op.start_crawl(url, max_pages=200)
        audit = SiteAudit.objects.create(
            client=client, target_url=url, max_pages=200,
            status="crawling", started_at=timezone.now(),
            dataforseo_task_id=task_id,
        )
        return Response({
            "message": f"Audit started for {url}",
            "audit_id": audit.id,
            "task_id": task_id,
        })

    @action(detail=True, methods=["post"], url_path="run-lighthouse")
    def run_lighthouse(self, request, pk=None):
        """Run Lighthouse test."""
        client = self.get_object()
        from services.dataforseo import DataForSEOClient, OnPageService
        from apps.onpage.models import LighthouseResult
        from django.conf import settings

        api = DataForSEOClient(settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
        op = OnPageService(api)
        url = client.website_url or f"https://{client.domain}"

        result = op.run_lighthouse(url, for_mobile=True)
        if not result:
            return Response({"error": "No result returned"}, status=500)

        cats = result.get("categories", {})
        lr = LighthouseResult.objects.create(
            client=client, url=url, is_mobile=True,
            performance_score=int((cats.get("performance", {}).get("score") or 0) * 100),
            accessibility_score=int((cats.get("accessibility", {}).get("score") or 0) * 100),
            best_practices_score=int((cats.get("best-practices", {}).get("score") or 0) * 100),
            seo_score=int((cats.get("seo", {}).get("score") or 0) * 100),
        )
        return Response({
            "message": "Lighthouse complete",
            "scores": {
                "performance": lr.performance_score,
                "accessibility": lr.accessibility_score,
                "best_practices": lr.best_practices_score,
                "seo": lr.seo_score,
            },
        })

    @action(detail=True, methods=["post"], url_path="run-competitors")
    def run_competitors(self, request, pk=None):
        """Discover competitor domains."""
        client = self.get_object()
        from services.dataforseo import DataForSEOClient, LabsService
        from apps.competitors.models import Competitor
        from django.conf import settings

        api = DataForSEOClient(settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
        labs = LabsService(api)

        result = labs.get_competitors_domain(client.domain, location_code=client.location_code, limit=20)
        created = 0
        for item in result.get("items", []):
            domain = item.get("domain", "")
            if domain and domain != client.domain:
                _, was_new = Competitor.objects.get_or_create(
                    client=client, domain=domain,
                    defaults={"name": domain, "is_auto_discovered": True},
                )
                if was_new:
                    created += 1
        return Response({"message": f"Found {created} new competitors"})

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
