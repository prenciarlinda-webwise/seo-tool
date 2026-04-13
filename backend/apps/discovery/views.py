from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.clients.models import Client
from apps.keywords.models import Keyword, KeywordStatus

from .models import DiscoveryResult, DiscoveryRun
from .serializers import (
    DiscoveryResultSerializer,
    DiscoveryRunSerializer,
    PromoteKeywordsSerializer,
)


class DiscoveryRunListView(generics.ListAPIView):
    serializer_class = DiscoveryRunSerializer

    def get_queryset(self):
        return DiscoveryRun.objects.filter(client__slug=self.kwargs["client_slug"])


class DiscoveryResultListView(generics.ListAPIView):
    serializer_class = DiscoveryResultSerializer
    filterset_fields = ["is_new", "is_interesting", "is_promoted", "source"]
    search_fields = ["keyword_text"]
    ordering_fields = ["search_volume", "rank_absolute", "keyword_difficulty"]

    def get_queryset(self):
        return DiscoveryResult.objects.filter(
            run_id=self.kwargs["run_pk"],
            client__slug=self.kwargs["client_slug"],
        )


class PromoteKeywordsView(APIView):
    def post(self, request, client_slug):
        serializer = PromoteKeywordsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        client = Client.objects.get(slug=client_slug)
        keyword_texts = serializer.validated_data["keyword_texts"]
        now = timezone.now()
        today = now.date()
        created = 0

        # Get the latest discovery results for these keywords
        latest_run = (
            DiscoveryRun.objects.filter(client=client, status="completed")
            .order_by("-run_date")
            .first()
        )

        for text in keyword_texts:
            discovery_result = None
            if latest_run:
                discovery_result = (
                    DiscoveryResult.objects.filter(run=latest_run, keyword_text=text)
                    .first()
                )

            defaults = {
                "status": KeywordStatus.TRACKED,
                "promoted_at": now,
                "first_discovered_at": today,
            }
            if discovery_result:
                defaults.update({
                    "search_volume": discovery_result.search_volume,
                    "competition": discovery_result.competition,
                    "competition_level": discovery_result.competition_level or "",
                    "cpc": discovery_result.cpc,
                    "keyword_difficulty": discovery_result.keyword_difficulty,
                    "discovery_rank": discovery_result.rank_absolute,
                    # Carry discovery rank into current rank so Dashboard/Tracker show it
                    "current_organic_rank": discovery_result.rank_absolute,
                    "current_organic_url": discovery_result.url or "",
                })

            keyword, was_created = Keyword.objects.get_or_create(
                client=client,
                keyword_text=text,
                location_code=None,
                defaults=defaults,
            )

            if not was_created and keyword.status != KeywordStatus.TRACKED:
                keyword.status = KeywordStatus.TRACKED
                keyword.promoted_at = now
                # Also update rank from discovery if keyword had no rank
                update_fields = ["status", "promoted_at", "updated_at"]
                if keyword.current_organic_rank is None and discovery_result and discovery_result.rank_absolute:
                    keyword.current_organic_rank = discovery_result.rank_absolute
                    keyword.current_organic_url = discovery_result.url or ""
                    update_fields += ["current_organic_rank", "current_organic_url"]
                keyword.save(update_fields=update_fields)

            if was_created:
                created += 1

            # Mark discovery result as promoted
            if discovery_result:
                discovery_result.is_promoted = True
                discovery_result.save(update_fields=["is_promoted"])

        return Response({"created": created, "total": len(keyword_texts)}, status=status.HTTP_200_OK)
