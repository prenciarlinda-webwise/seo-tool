import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.keywords.models import KeywordStatus
from apps.rankings.models import LocalFinderResult, MapsRankResult, SERPResult
from services.dataforseo.exceptions import DataForSEOAPIError

from .models import Client
from .serializers import ClientListSerializer, ClientSerializer

logger = logging.getLogger(__name__)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    search_fields = ["name", "domain"]
    filterset_fields = ["is_active", "track_organic", "track_maps"]
    ordering_fields = ["name", "domain", "created_at"]
    lookup_field = "slug"

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
            monthly_keyword_discovery.delay(client_id=client.id)

        # Check citations if any exist
        if client.citations.exists():
            check_citations_for_client.delay(client.id)

    @action(detail=True, methods=["post"])
    def sync(self, request, slug=None):
        """Full data sync — each step independent, errors don't block next step."""
        client = self.get_object()
        results = {}

        # 1. Discovery
        try:
            from apps.discovery.tasks import _discover_keywords_for_client
            disc = _discover_keywords_for_client(client)
            results["discovery"] = disc.get("total", 0) if isinstance(disc, dict) else "done"
        except Exception as e:
            results["discovery"] = f"skipped: {e}"

        # 2. Auto-promote top keywords
        try:
            from apps.keywords.models import Keyword
            promoted = 0
            for kw in Keyword.objects.filter(client=client, status="discovered"):
                if (kw.search_volume and kw.search_volume >= 50
                        and kw.discovery_rank and kw.discovery_rank <= 50):
                    kw.status = "tracked"
                    kw.promoted_at = timezone.now()
                    # Carry discovery rank into current rank
                    if kw.current_organic_rank is None and kw.discovery_rank:
                        kw.current_organic_rank = kw.discovery_rank
                    kw.save(update_fields=[
                        "status", "promoted_at", "current_organic_rank", "updated_at",
                    ])
                    promoted += 1
            results["auto_promoted"] = promoted
        except Exception as e:
            results["auto_promoted"] = f"failed: {e}"

        # 3. Competitors
        try:
            from services.dataforseo import LabsService
            from apps.competitors.models import Competitor
            api = self._api_client()
            labs = LabsService(api)
            comp_result = labs.get_competitors_domain(client.domain, location_code=client.location_code, limit=10)
            created = sum(
                1 for item in comp_result.get("items", [])
                if item.get("domain") and item["domain"] != client.domain
                and Competitor.objects.get_or_create(
                    client=client, domain=item["domain"],
                    defaults={"name": item["domain"], "is_auto_discovered": True}
                )[1]
            )
            results["competitors"] = created
        except Exception as e:
            results["competitors"] = f"skipped: {e}"

        # 4. Rank tracking — spawn as subprocess (survives server restarts)
        import subprocess, sys
        subprocess.Popen(
            [sys.executable, "manage.py", "weekly_scan", "--client", str(client.id), "--no-discovery", "--no-screenshots"],
            cwd=str(settings.BASE_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        results["ranks_checked"] = "started in background"

        # 5. Citations
        try:
            if client.citations.exists():
                from apps.citations.tasks import check_citations_for_client
                check_citations_for_client(client.id)
                results["citations"] = "checked"
            else:
                results["citations"] = "none configured"
        except Exception as e:
            results["citations"] = f"skipped: {e}"

        return Response({
            "message": f"Sync complete for {client.name}",
            "results": results,
        })

    def _api_client(self):
        from django.conf import settings
        from services.dataforseo import DataForSEOClient
        return DataForSEOClient(settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)

    @action(detail=True, methods=["post"], url_path="run-discovery")
    def run_discovery(self, request, slug=None):
        client = self.get_object()
        try:
            from apps.discovery.tasks import _discover_keywords_for_client
            result = _discover_keywords_for_client(client)
            return Response({"message": "Discovery complete", "result": result})
        except DataForSEOAPIError as e:
            return Response({"message": f"Discovery unavailable: {e}"}, status=200)
        except Exception as e:
            logger.exception("Discovery failed for %s", client.domain)
            return Response({"message": f"Discovery failed: {e}"}, status=200)

    @action(detail=True, methods=["post"], url_path="run-ranks")
    def run_ranks(self, request, slug=None):
        import subprocess, sys
        client = self.get_object()
        from apps.keywords.models import Keyword
        tracked_count = Keyword.objects.filter(client=client, status="tracked").count()

        if tracked_count == 0:
            return Response({"message": "No tracked keywords to check."})

        # Spawn management command as a subprocess — survives server restarts
        subprocess.Popen(
            [sys.executable, "manage.py", "weekly_scan", "--client", str(client.id), "--no-discovery", "--no-screenshots"],
            cwd=str(settings.BASE_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        return Response({
            "message": f"Rank check started for {tracked_count} keywords. Results arrive in 2-5 min — refresh to see updates."
        })

    @action(detail=True, methods=["post"], url_path="run-backlinks")
    def run_backlinks(self, request, slug=None):
        client = self.get_object()
        try:
            from services.dataforseo import BacklinksService
            from apps.backlinks.models import BacklinkSnapshot, Backlink, ReferringDomain, AnchorText
            from datetime import date

            api = self._api_client()
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

            for item in bl.get_backlinks(client.domain, limit=100).get("items", []):
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

            for item in bl.get_referring_domains(client.domain, limit=100).get("items", []):
                ReferringDomain.objects.create(
                    client=client, snapshot=snap,
                    domain=item.get("domain", ""),
                    backlinks_count=item.get("backlinks", 0),
                    dofollow_count=item.get("dofollow", 0),
                    nofollow_count=item.get("nofollow", 0),
                    rank=item.get("rank"),
                )

            for item in bl.get_anchors(client.domain, limit=100).get("items", []):
                AnchorText.objects.create(
                    client=client, snapshot=snap,
                    anchor=item.get("anchor", ""),
                    backlinks_count=item.get("backlinks", 0),
                    referring_domains=item.get("referring_domains", 0),
                    dofollow=item.get("dofollow", 0),
                )

            return Response({"message": f"Backlinks: {snap.total_backlinks} links, {snap.referring_domains} domains"})
        except DataForSEOAPIError as e:
            return Response({"message": f"Backlinks unavailable: {e}"}, status=200)
        except Exception as e:
            logger.exception("Backlinks failed for %s", client.domain)
            return Response({"message": f"Backlinks failed: {e}"}, status=200)

    @action(detail=True, methods=["post"], url_path="run-audit")
    def run_audit(self, request, slug=None):
        client = self.get_object()
        try:
            from services.dataforseo import OnPageService
            from apps.onpage.models import SiteAudit

            api = self._api_client()
            op = OnPageService(api)
            url = client.website_url or f"https://{client.domain}"

            task_id = op.start_crawl(url, max_pages=200)
            audit = SiteAudit.objects.create(
                client=client, target_url=url, max_pages=200,
                status="crawling", started_at=timezone.now(),
                dataforseo_task_id=task_id,
            )
            return Response({"message": f"Audit started for {url}. Results in 2-5 min.", "audit_id": audit.id})
        except DataForSEOAPIError as e:
            return Response({"message": f"Audit unavailable: {e}"}, status=200)
        except Exception as e:
            logger.exception("Audit failed for %s", client.domain)
            return Response({"message": f"Audit failed: {e}"}, status=200)

    @action(detail=True, methods=["post"], url_path="fetch-audit-results")
    def fetch_audit_results(self, request, slug=None):
        """Poll DataForSEO for crawl results and populate the SiteAudit + AuditPages."""
        client = self.get_object()
        try:
            from services.dataforseo import OnPageService
            from apps.onpage.models import SiteAudit, AuditPage

            audit = SiteAudit.objects.filter(
                client=client, status="crawling",
            ).order_by("-created_at").first()

            if not audit or not audit.dataforseo_task_id:
                return Response({"message": "No crawling audit found.", "status": "none"})

            api = self._api_client()
            op = OnPageService(api)

            summary = op.get_crawl_summary(audit.dataforseo_task_id)
            if not summary:
                return Response({"message": "Crawl still in progress. Try again in a minute.", "status": "crawling"})

            crawl_progress = summary.get("crawl_progress", "")
            if crawl_progress != "finished":
                return Response({
                    "message": f"Crawl in progress ({crawl_progress}). Try again soon.",
                    "status": "crawling",
                })

            # Crawl finished — extract summary stats
            crawl_status = summary.get("crawl_status", {}) or {}
            domain_info = summary.get("domain_info", {}) or {}

            audit.pages_crawled = crawl_status.get("pages_crawled", 0)
            audit.pages_with_errors = crawl_status.get("pages_with_errors", 0) or 0
            audit.pages_with_warnings = crawl_status.get("pages_with_warnings", 0) or 0

            # Page errors
            page_metrics = summary.get("page_metrics", {}) or {}
            checks = page_metrics.get("checks", {}) or {}
            audit.total_4xx_errors = checks.get("is_4xx_code", 0) or 0
            audit.total_5xx_errors = checks.get("is_5xx_code", 0) or 0
            audit.broken_links_count = checks.get("is_broken", 0) or 0
            audit.redirect_chains_count = checks.get("is_redirect", 0) or 0

            # SEO checks
            audit.duplicate_titles = checks.get("has_duplicate_title", 0) or 0
            audit.duplicate_descriptions = checks.get("has_duplicate_description", 0) or 0
            audit.missing_titles = checks.get("no_title", 0) or 0
            audit.missing_descriptions = checks.get("no_description", 0) or 0
            audit.missing_h1 = checks.get("no_h1_tag", 0) or 0
            audit.missing_alt_tags = checks.get("no_image_alt", 0) or 0
            audit.non_indexable_pages = checks.get("is_non_indexable", 0) or 0
            audit.thin_content_pages = checks.get("low_content_rate", 0) or 0

            # SSL
            audit.has_ssl = domain_info.get("ssl_info", {}).get("valid_certificate", None)
            audit.has_robots_txt = domain_info.get("checks", {}).get("robots_txt", None) if domain_info.get("checks") else None
            audit.has_sitemap = domain_info.get("checks", {}).get("sitemap", None) if domain_info.get("checks") else None

            # Performance from page_metrics
            audit.avg_page_load_time = page_metrics.get("avg_load_time")
            audit.avg_page_size = page_metrics.get("avg_size")
            audit.avg_word_count = page_metrics.get("avg_content_length")

            audit.status = "completed"
            audit.completed_at = timezone.now()
            audit.save()

            # Fetch individual pages
            pages_data = op.get_pages(audit.dataforseo_task_id, limit=200)
            pages_created = 0
            for item in pages_data.get("items", []):
                meta = item.get("meta", {}) or {}
                onpage_score = item.get("onpage_score")
                AuditPage.objects.update_or_create(
                    audit=audit,
                    url=item.get("url", ""),
                    defaults={
                        "client": client,
                        "status_code": item.get("status_code"),
                        "title": (meta.get("title") or "")[:1000],
                        "description": meta.get("description") or "",
                        "h1": (meta.get("htags", {}) or {}).get("h1", [""])[0][:1000] if (meta.get("htags", {}) or {}).get("h1") else "",
                        "word_count": meta.get("content", {}).get("plain_text_word_count") if meta.get("content") else None,
                        "content_size": item.get("size"),
                        "page_load_time": item.get("fetch_time"),
                        "page_size": item.get("size"),
                        "internal_links_count": item.get("internal_links_count", 0) or 0,
                        "external_links_count": item.get("external_links_count", 0) or 0,
                        "broken_links_count": item.get("broken_links", 0) or 0,
                        "images_count": item.get("images_count", 0) or 0,
                        "images_missing_alt": item.get("images_alt_count", 0) or 0,
                        "is_indexable": not (item.get("meta", {}) or {}).get("is_non_indexable", False),
                        "errors": item.get("checks", {}) if item.get("checks") else [],
                        "warnings": [],
                    },
                )
                pages_created += 1

            return Response({
                "message": f"Audit complete: {audit.pages_crawled} pages crawled, {pages_created} page records.",
                "status": "completed",
                "audit_id": audit.id,
            })
        except DataForSEOAPIError as e:
            return Response({"message": f"Fetch failed: {e}", "status": "error"}, status=200)
        except Exception as e:
            logger.exception("Fetch audit results failed for %s", client.domain)
            return Response({"message": f"Fetch failed: {e}", "status": "error"}, status=200)

    @action(detail=True, methods=["post"], url_path="run-lighthouse")
    def run_lighthouse(self, request, slug=None):
        client = self.get_object()
        try:
            from services.dataforseo import OnPageService
            from apps.onpage.models import LighthouseResult

            api = self._api_client()
            op = OnPageService(api)
            url = client.website_url or f"https://{client.domain}"

            result = op.run_lighthouse(url, for_mobile=True)
            if not result:
                return Response({"message": "Lighthouse returned no data"})

            cats = result.get("categories", {})
            lr = LighthouseResult.objects.create(
                client=client, url=url, is_mobile=True,
                performance_score=int((cats.get("performance", {}).get("score") or 0) * 100),
                accessibility_score=int((cats.get("accessibility", {}).get("score") or 0) * 100),
                best_practices_score=int((cats.get("best-practices", {}).get("score") or 0) * 100),
                seo_score=int((cats.get("seo", {}).get("score") or 0) * 100),
            )
            return Response({"message": f"Lighthouse: Perf={lr.performance_score} SEO={lr.seo_score} A11y={lr.accessibility_score}"})
        except DataForSEOAPIError as e:
            return Response({"message": f"Lighthouse unavailable: {e}"}, status=200)
        except Exception as e:
            logger.exception("Lighthouse failed for %s", client.domain)
            return Response({"message": f"Lighthouse failed: {e}"}, status=200)

    @action(detail=True, methods=["post"], url_path="run-competitors")
    def run_competitors(self, request, slug=None):
        client = self.get_object()
        try:
            from services.dataforseo import LabsService
            from apps.competitors.models import Competitor

            api = self._api_client()
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
        except DataForSEOAPIError as e:
            return Response({"message": f"Competitors unavailable: {e}"}, status=200)
        except Exception as e:
            logger.exception("Competitors failed for %s", client.domain)
            return Response({"message": f"Competitors failed: {e}"}, status=200)

    @action(detail=True, methods=["get"])
    def summary(self, request, slug=None):
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
            SERPResult.objects.filter(client=client, device="desktop"), "rank_absolute",
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

        mobile_summary = _type_summary(
            tracked, "current_mobile_rank",
            SERPResult.objects.filter(client=client, device="mobile"), "rank_absolute",
            top_ns=[3, 10, 20, 50],
        )

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
