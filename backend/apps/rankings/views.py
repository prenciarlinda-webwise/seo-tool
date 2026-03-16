from collections import defaultdict

from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.keywords.models import Keyword, KeywordStatus

from .models import LocalFinderResult, MapsRankResult, SERPResult
from .serializers import (
    LatestRankSerializer,
    MapsRankResultSerializer,
    SERPResultSerializer,
)


class OrganicRankListView(generics.ListAPIView):
    serializer_class = SERPResultSerializer
    filterset_fields = ["keyword", "is_found", "checked_at"]
    ordering_fields = ["checked_at", "rank_absolute"]

    def get_queryset(self):
        qs = SERPResult.objects.filter(
            client_id=self.kwargs["client_pk"]
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
            client_id=self.kwargs["client_pk"]
        ).select_related("keyword")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(checked_at__gte=date_from)
        if date_to:
            qs = qs.filter(checked_at__lte=date_to)
        return qs


class LatestRankView(APIView):
    def get(self, request, client_pk):
        keywords = Keyword.objects.filter(
            client_id=client_pk, status=KeywordStatus.TRACKED,
        ).order_by("keyword_text")
        data = [
            {
                "keyword_id": kw.id,
                "keyword_text": kw.keyword_text,
                "organic_rank": kw.current_organic_rank,
                "organic_url": kw.current_organic_url,
                "organic_rank_change": kw.rank_change,
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


class RankChangesView(APIView):
    def get(self, request, client_pk):
        keywords = Keyword.objects.filter(
            client_id=client_pk, status=KeywordStatus.TRACKED,
            rank_change__isnull=False,
        ).exclude(rank_change=0).order_by("-rank_change")
        data = [
            {
                "keyword_id": kw.id,
                "keyword_text": kw.keyword_text,
                "organic_rank": kw.current_organic_rank,
                "organic_url": kw.current_organic_url,
                "organic_rank_change": kw.rank_change,
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
    def get(self, request, client_pk):
        organic_dates = list(
            SERPResult.objects.filter(client_id=client_pk)
            .values_list("checked_at", flat=True).distinct().order_by("-checked_at")[:20]
        )
        maps_dates = list(
            MapsRankResult.objects.filter(client_id=client_pk)
            .values_list("checked_at", flat=True).distinct().order_by("-checked_at")[:20]
        )
        finder_dates = list(
            LocalFinderResult.objects.filter(client_id=client_pk)
            .values_list("checked_at", flat=True).distinct().order_by("-checked_at")[:20]
        )
        all_dates = sorted(set(organic_dates + maps_dates + finder_dates), reverse=True)
        return Response({"dates": [d.isoformat() for d in all_dates]})


def _build_type_summary(ranks_current, ranks_previous, changes, label, top_ns=None):
    """Build a per-type summary dict with movement calculated from actual period data."""
    if top_ns is None:
        top_ns = [3, 10, 20, 50]

    found = len(ranks_current)
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

    def get(self, request, client_pk):
        date_current = request.query_params.get("date_current")
        date_previous = request.query_params.get("date_previous")
        max_rank = request.query_params.get("max_rank")

        keywords = Keyword.objects.filter(
            client_id=client_pk, status=KeywordStatus.TRACKED,
        ).order_by("keyword_text")
        kw_ids = list(keywords.values_list("id", flat=True))

        def _index_by_kw(qs):
            return {obj.keyword_id: obj for obj in qs}

        # Current
        oc = _index_by_kw(SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current)) if date_current else {}
        mc = _index_by_kw(MapsRankResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current)) if date_current else {}
        fc = _index_by_kw(LocalFinderResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_current)) if date_current else {}

        # Previous
        op = _index_by_kw(SERPResult.objects.filter(keyword_id__in=kw_ids, checked_at=date_previous)) if date_previous else {}
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
            maps_rank = mc[kw.id].rank_group if kw.id in mc else None
            maps_prev = mp[kw.id].rank_group if kw.id in mp else None
            finder_rank = fc[kw.id].rank if kw.id in fc else None
            finder_prev = fp[kw.id].rank if kw.id in fp else None

            organic_change = _change(organic_rank, organic_prev)
            maps_change = _change(maps_rank, maps_prev)
            finder_change = _change(finder_rank, finder_prev)

            # Collect for summaries
            desktop_current.append(organic_rank)
            desktop_previous.append(organic_prev)
            desktop_changes.append(organic_change)
            # Mobile placeholder
            mobile_current.append(None)
            mobile_previous.append(None)
            mobile_changes.append(None)
            pack_current.append(maps_rank)
            pack_previous.append(maps_prev)
            pack_changes.append(maps_change)
            finder_current.append(finder_rank)
            finder_previous.append(finder_prev)
            finder_changes.append(finder_change)

            if max_rank:
                max_r = int(max_rank)
                if not any(r is not None and r <= max_r for r in [organic_rank, maps_rank, finder_rank]):
                    continue

            oc_obj = oc.get(kw.id)
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
                "organic_mobile_rank": None,
                "organic_mobile_change": None,
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
