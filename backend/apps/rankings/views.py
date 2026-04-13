from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.competitors.models import Competitor
from apps.keywords.models import Keyword, KeywordStatus

from .models import LocalFinderResult, MapsRankResult, SERPResult
from .serializers import (
    LatestRankSerializer,
    LocalFinderResultSerializer,
    MapsRankResultSerializer,
    SERPResultSerializer,
)


class OrganicRankListView(generics.ListAPIView):
    serializer_class = SERPResultSerializer
    filterset_fields = ["keyword", "is_found", "checked_at", "device"]
    ordering_fields = ["checked_at", "rank_absolute"]

    def get_queryset(self):
        qs = SERPResult.objects.filter(
            client__slug=self.kwargs["client_slug"]
        ).select_related("keyword")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(checked_at__gte=date_from)
        if date_to:
            qs = qs.filter(checked_at__lte=date_to)
        return qs


class MapsRankListView(generics.ListAPIView):
    serializer_class = MapsRankResultSerializer
    filterset_fields = ["keyword", "is_found", "checked_at"]
    ordering_fields = ["checked_at", "rank_group"]

    def get_queryset(self):
        qs = MapsRankResult.objects.filter(
            client__slug=self.kwargs["client_slug"]
        ).select_related("keyword")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(checked_at__gte=date_from)
        if date_to:
            qs = qs.filter(checked_at__lte=date_to)
        return qs


class LocalFinderListView(generics.ListAPIView):
    serializer_class = LocalFinderResultSerializer
    filterset_fields = ["keyword", "is_found", "checked_at"]
    ordering_fields = ["checked_at", "rank"]

    def get_queryset(self):
        qs = LocalFinderResult.objects.filter(
            client__slug=self.kwargs["client_slug"]
        ).select_related("keyword")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(checked_at__gte=date_from)
        if date_to:
            qs = qs.filter(checked_at__lte=date_to)
        return qs


class LatestRankView(APIView):
    """Primary rank view — reads from Keyword denormalized fields.
    This is the single source of truth that Dashboard, Pages, and Rank Tracker all use.
    SERP URLs and screenshots come from the latest SERPResult records."""

    def get(self, request, client_slug):
        keywords = Keyword.objects.filter(
            client__slug=client_slug, status=KeywordStatus.TRACKED,
        ).order_by("keyword_text")
        kw_ids = list(keywords.values_list("id", flat=True))

        # Get latest SERP result per keyword for SERP URLs & screenshots
        latest_serp = {}
        latest_mobile = {}
        latest_maps = {}
        for r in SERPResult.objects.filter(keyword_id__in=kw_ids, device="desktop").order_by("-checked_at"):
            if r.keyword_id not in latest_serp:
                latest_serp[r.keyword_id] = r
        for r in SERPResult.objects.filter(keyword_id__in=kw_ids, device="mobile").order_by("-checked_at"):
            if r.keyword_id not in latest_mobile:
                latest_mobile[r.keyword_id] = r
        for r in MapsRankResult.objects.filter(keyword_id__in=kw_ids).order_by("-checked_at"):
            if r.keyword_id not in latest_maps:
                latest_maps[r.keyword_id] = r

        # Optionally compare with a past date
        compare_date = request.query_params.get("compare_date")
        past_serp = {}
        past_mobile = {}
        past_maps = {}
        if compare_date:
            for r in SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=compare_date, device="desktop"):
                past_serp[r.keyword_id] = r.rank_absolute
            for r in SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=compare_date, device="mobile"):
                past_mobile[r.keyword_id] = r.rank_absolute
            for r in MapsRankResult.objects.filter(keyword_id__in=kw_ids, checked_at=compare_date):
                past_maps[r.keyword_id] = r.rank_group

        data = []
        for kw in keywords:
            organic_rank = kw.current_organic_rank
            mobile_rank = kw.current_mobile_rank
            maps_rank = kw.current_maps_rank

            # Compute change vs compare_date if provided, otherwise use stored change
            if compare_date:
                prev_org = past_serp.get(kw.id)
                org_change = (prev_org - organic_rank) if (prev_org and organic_rank) else None
                prev_mob = past_mobile.get(kw.id)
                mob_change = (prev_mob - mobile_rank) if (prev_mob and mobile_rank) else None
                prev_mp = past_maps.get(kw.id)
                maps_change = (prev_mp - maps_rank) if (prev_mp and maps_rank) else None
            else:
                org_change = kw.rank_change
                mob_change = kw.mobile_rank_change
                maps_change = (
                    kw.previous_maps_rank - kw.current_maps_rank
                    if kw.previous_maps_rank and kw.current_maps_rank else None
                )

            # SERP URLs and screenshots from latest results
            serp_obj = latest_serp.get(kw.id)
            mob_obj = latest_mobile.get(kw.id)
            maps_obj = latest_maps.get(kw.id)

            data.append({
                "keyword_id": kw.id,
                "keyword_text": kw.keyword_text,
                "search_volume": kw.search_volume,
                "keyword_difficulty": kw.keyword_difficulty,
                "organic_rank": organic_rank,
                "organic_url": kw.current_organic_url,
                "organic_rank_change": org_change,
                "organic_serp_url": serp_obj.serp_url if serp_obj else "",
                "organic_screenshot_url": serp_obj.screenshot_url if serp_obj else "",
                "mobile_rank": mobile_rank,
                "mobile_url": kw.current_mobile_url,
                "mobile_rank_change": mob_change,
                "mobile_serp_url": mob_obj.serp_url if mob_obj else "",
                "maps_rank": maps_rank,
                "maps_rank_change": maps_change,
                "maps_serp_url": maps_obj.serp_url if maps_obj else "",
                "last_checked": kw.last_checked_at,
            })

        # Build summary
        def _summarize(ranks, changes, top_ns=None):
            if top_ns is None:
                top_ns = [3, 10, 20, 50]
            non_null = [r for r in ranks if r is not None]
            improved = sum(1 for c in changes if c is not None and c > 0)
            declined = sum(1 for c in changes if c is not None and c < 0)
            new_kws = sum(1 for r, c in zip(ranks, changes) if r is not None and c is None)
            result = {
                "found": len(non_null),
                "avg_rank": round(sum(non_null) / len(non_null), 1) if non_null else None,
                "improved": improved,
                "declined": declined,
                "new": new_kws,
            }
            for n in top_ns:
                result[f"in_top_{n}"] = sum(1 for r in non_null if r <= n)
            return result

        org_ranks = [d["organic_rank"] for d in data]
        org_changes = [d["organic_rank_change"] for d in data]
        mob_ranks = [d["mobile_rank"] for d in data]
        mob_changes = [d["mobile_rank_change"] for d in data]
        maps_ranks = [d["maps_rank"] for d in data]
        maps_changes = [d["maps_rank_change"] for d in data]

        summary = {
            "total_keywords": len(data),
            "desktop": _summarize(org_ranks, org_changes),
            "mobile": _summarize(mob_ranks, mob_changes),
            "local_pack": _summarize(maps_ranks, maps_changes, top_ns=[3]),
        }

        # Client location for constructing localized SERP URLs
        from apps.clients.models import Client
        client = Client.objects.get(slug=client_slug)
        location = ""
        if client.city and client.state:
            location = f"{client.city}, {client.state}"
        elif client.city:
            location = client.city

        return Response({
            "summary": summary,
            "keywords": data,
            "location": location,
        })


class RankChangesView(APIView):
    def get(self, request, client_slug):
        keywords = Keyword.objects.filter(
            client__slug=client_slug, status=KeywordStatus.TRACKED,
            rank_change__isnull=False,
        ).exclude(rank_change=0).order_by("-rank_change")
        data = [
            {
                "keyword_id": kw.id,
                "keyword_text": kw.keyword_text,
                "organic_rank": kw.current_organic_rank,
                "organic_url": kw.current_organic_url,
                "organic_rank_change": kw.rank_change,
                "mobile_rank": kw.current_mobile_rank,
                "mobile_url": kw.current_mobile_url,
                "mobile_rank_change": kw.mobile_rank_change,
                "maps_rank": kw.current_maps_rank,
                "maps_rank_change": (
                    kw.previous_maps_rank - kw.current_maps_rank
                    if kw.previous_maps_rank and kw.current_maps_rank else None
                ),
                "last_checked": kw.last_checked_at,
            }
            for kw in keywords
        ]
        serializer = LatestRankSerializer(data, many=True)
        return Response(serializer.data)


class CheckDatesView(APIView):
    def get(self, request, client_slug):
        from django.db.models import Count

        organic_dates = list(
            SERPResult.objects.filter(client__slug=client_slug)
            .values_list("checked_at", flat=True).distinct().order_by("-checked_at")[:20]
        )
        maps_dates = list(
            MapsRankResult.objects.filter(client__slug=client_slug)
            .values_list("checked_at", flat=True).distinct().order_by("-checked_at")[:20]
        )
        finder_dates = list(
            LocalFinderResult.objects.filter(client__slug=client_slug)
            .values_list("checked_at", flat=True).distinct().order_by("-checked_at")[:20]
        )
        all_dates = sorted(set(organic_dates + maps_dates + finder_dates), reverse=True)

        # Include keyword count per date so frontend can pick the most complete date
        date_counts = {}
        for row in (
            SERPResult.objects.filter(client__slug=client_slug, device="desktop")
            .values("checked_at")
            .annotate(cnt=Count("id"))
        ):
            date_counts[row["checked_at"].isoformat()] = row["cnt"]

        return Response({
            "dates": [
                {"date": d.isoformat(), "keywords_checked": date_counts.get(d.isoformat(), 0)}
                for d in all_dates
            ],
        })


def _build_type_summary(ranks_current, ranks_previous, changes, label, top_ns=None):
    """Build a per-type summary dict with movement calculated from actual period data."""
    if top_ns is None:
        top_ns = [3, 10, 20, 50]

    found = sum(1 for r in ranks_current if r is not None)
    improved = sum(1 for c in changes if c is not None and c > 0)
    declined = sum(1 for c in changes if c is not None and c < 0)
    # Keywords that appeared (have current but no previous)
    new_kws = sum(1 for rc, rp in zip(ranks_current, ranks_previous) if rc is not None and rp is None)
    # Keywords that disappeared (had previous but no current)
    lost_kws = sum(1 for rc, rp in zip(ranks_current, ranks_previous) if rc is None and rp is not None)

    non_null = [r for r in ranks_current if r is not None]
    avg_rank = round(sum(non_null) / len(non_null), 1) if non_null else None

    result = {
        "found": found,
        "avg_rank": avg_rank,
        "improved": improved,
        "declined": declined,
        "no_change": sum(1 for c in changes if c is not None and c == 0),
        "new": new_kws,
        "lost": lost_kws,
    }

    for n in top_ns:
        result[f"in_top_{n}"] = sum(1 for r in non_null if r <= n)

    return result


class RankComparisonView(APIView):
    """
    Returns per-type summaries (Desktop, Mobile, Local Pack, Local Finder)
    with TRUE movement for the selected period.
    """

    def get(self, request, client_slug):
        date_current = request.query_params.get("date_current")
        date_previous = request.query_params.get("date_previous")
        max_rank = request.query_params.get("max_rank")

        keywords = Keyword.objects.filter(
            client__slug=client_slug, status=KeywordStatus.TRACKED,
        ).order_by("keyword_text")
        kw_ids = list(keywords.values_list("id", flat=True))

        def _index_by_kw(qs):
            return {obj.keyword_id: obj for obj in qs}

        # Current
        oc = _index_by_kw(SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current, device="desktop")) if date_current else {}
        mob_c = _index_by_kw(SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current, device="mobile")) if date_current else {}
        mc = _index_by_kw(MapsRankResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current)) if date_current else {}
        fc = _index_by_kw(LocalFinderResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current)) if date_current else {}

        # Previous
        op = _index_by_kw(SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_previous, device="desktop")) if date_previous else {}
        mob_p = _index_by_kw(SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_previous, device="mobile")) if date_previous else {}
        mp = _index_by_kw(MapsRankResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_previous)) if date_previous else {}
        fp = _index_by_kw(LocalFinderResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_previous)) if date_previous else {}

        def _change(current, previous):
            if current is not None and previous is not None:
                return previous - current
            return None

        rows = []
        # Collect per-type data for summaries
        desktop_current, desktop_previous, desktop_changes = [], [], []
        mobile_current, mobile_previous, mobile_changes = [], [], []
        pack_current, pack_previous, pack_changes = [], [], []
        finder_current, finder_previous, finder_changes = [], [], []

        for kw in keywords:
            organic_rank = oc[kw.id].rank_absolute if kw.id in oc else None
            organic_prev = op[kw.id].rank_absolute if kw.id in op else None
            mob_rank = mob_c[kw.id].rank_absolute if kw.id in mob_c else None
            mob_prev = mob_p[kw.id].rank_absolute if kw.id in mob_p else None
            maps_rank = mc[kw.id].rank_group if kw.id in mc else None
            maps_prev = mp[kw.id].rank_group if kw.id in mp else None
            finder_rank = fc[kw.id].rank if kw.id in fc else None
            finder_prev = fp[kw.id].rank if kw.id in fp else None

            organic_change = _change(organic_rank, organic_prev)
            mob_change = _change(mob_rank, mob_prev)
            maps_change = _change(maps_rank, maps_prev)
            finder_change = _change(finder_rank, finder_prev)

            # Collect for summaries
            desktop_current.append(organic_rank)
            desktop_previous.append(organic_prev)
            desktop_changes.append(organic_change)
            mobile_current.append(mob_rank)
            mobile_previous.append(mob_prev)
            mobile_changes.append(mob_change)
            pack_current.append(maps_rank)
            pack_previous.append(maps_prev)
            pack_changes.append(maps_change)
            finder_current.append(finder_rank)
            finder_previous.append(finder_prev)
            finder_changes.append(finder_change)

            if max_rank:
                max_r = int(max_rank)
                if not any(r is not None and r <= max_r for r in [organic_rank, mob_rank, maps_rank, finder_rank]):
                    continue

            oc_obj = oc.get(kw.id)
            mob_obj = mob_c.get(kw.id)
            mc_obj = mc.get(kw.id)
            fc_obj = fc.get(kw.id)

            rows.append({
                "keyword_id": kw.id,
                "keyword_text": kw.keyword_text,
                "search_volume": kw.search_volume,
                "group_name": kw.group_name,
                "tags": list(kw.tags.values_list("name", flat=True)),
                "organic_rank": organic_rank,
                "organic_change": organic_change,
                "organic_url": oc_obj.url if oc_obj else "",
                "organic_serp_url": oc_obj.serp_url if oc_obj else "",
                "organic_screenshot_url": oc_obj.screenshot_url if oc_obj else "",
                "organic_serp_features": {
                    "featured_snippet": oc_obj.featured_snippet_present,
                    "local_pack": oc_obj.local_pack_present,
                    "ai_overview": oc_obj.ai_overview_present,
                    "people_also_ask": oc_obj.people_also_ask_present,
                } if oc_obj else {},
                "organic_mobile_rank": mob_rank,
                "organic_mobile_change": mob_change,
                "organic_mobile_url": mob_obj.url if mob_obj else "",
                "organic_mobile_serp_url": mob_obj.serp_url if mob_obj else "",
                "organic_mobile_screenshot_url": mob_obj.screenshot_url if mob_obj else "",
                "local_pack_rank": maps_rank,
                "local_pack_change": maps_change,
                "local_pack_serp_url": mc_obj.serp_url if mc_obj else "",
                "local_pack_screenshot_url": mc_obj.screenshot_url if mc_obj else "",
                "local_finder_rank": finder_rank,
                "local_finder_change": finder_change,
                "local_finder_serp_url": fc_obj.serp_url if fc_obj else "",
                "local_finder_screenshot_url": fc_obj.screenshot_url if fc_obj else "",
            })

        summary = {
            "total_keywords": len(keywords),
            "desktop": _build_type_summary(
                desktop_current, desktop_previous, desktop_changes, "desktop",
                top_ns=[3, 10, 20, 50],
            ),
            "mobile": _build_type_summary(
                mobile_current, mobile_previous, mobile_changes, "mobile",
                top_ns=[3, 10, 20, 50],
            ),
            "local_pack": _build_type_summary(
                pack_current, pack_previous, pack_changes, "local_pack",
                top_ns=[3],
            ),
            "local_finder": _build_type_summary(
                finder_current, finder_previous, finder_changes, "local_finder",
                top_ns=[3, 10, 20],
            ),
        }

        return Response({
            "date_current": date_current,
            "date_previous": date_previous,
            "summary": summary,
            "keywords": rows,
        })


class CompetitorRankingsView(APIView):
    """
    Returns competitor ranking positions from CompetitorKeywordOverlap,
    populated during rank tracking from the full SERP data.
    """

    def get(self, request, client_slug):
        from apps.competitors.models import CompetitorKeywordOverlap

        date_current = request.query_params.get("date_current")
        date_previous = request.query_params.get("date_previous")

        competitors = list(
            Competitor.objects.filter(client__slug=client_slug).values("id", "domain", "name")
        )
        if not competitors or not date_current:
            return Response({"keywords": [], "competitors": []})

        comp_ids = [c["id"] for c in competitors]

        keywords = Keyword.objects.filter(
            client__slug=client_slug, status=KeywordStatus.TRACKED,
        ).order_by("keyword_text")

        # Get the client_id for overlap filtering (already resolved by slug)
        client_id = keywords.first().client_id if keywords.exists() else None
        if not client_id:
            return Response({"keywords": [], "competitors": competitors})

        # Index overlaps: (competitor_id, keyword_text) -> overlap
        overlaps_current = {}
        for o in CompetitorKeywordOverlap.objects.filter(
            client_id=client_id, competitor_id__in=comp_ids, date=date_current,
        ):
            overlaps_current[(o.competitor_id, o.keyword_text)] = o

        overlaps_previous = {}
        if date_previous and date_previous != date_current:
            for o in CompetitorKeywordOverlap.objects.filter(
                client_id=client_id, competitor_id__in=comp_ids, date=date_previous,
            ):
                overlaps_previous[(o.competitor_id, o.keyword_text)] = o

        rows = []
        for kw in keywords:
            comp_ranks = {}
            for comp in competitors:
                oc = overlaps_current.get((comp["id"], kw.keyword_text))
                op = overlaps_previous.get((comp["id"], kw.keyword_text))
                rank_c = oc.competitor_rank if oc else None
                rank_p = op.competitor_rank if op else None
                change = None
                if rank_c is not None and rank_p is not None:
                    change = rank_p - rank_c
                comp_ranks[comp["id"]] = {
                    "rank": rank_c,
                    "change": change,
                }

            rows.append({
                "keyword_id": kw.id,
                "keyword_text": kw.keyword_text,
                "search_volume": kw.search_volume,
                "client_rank": kw.current_organic_rank,
                "competitors": comp_ranks,
            })

        return Response({
            "date_current": date_current,
            "date_previous": date_previous,
            "competitors": competitors,
            "keywords": rows,
        })
