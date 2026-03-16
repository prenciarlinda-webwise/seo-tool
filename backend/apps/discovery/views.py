from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

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
        return DiscoveryRun.objects.filter(client_id=self.kwargs["client_pk"])


class DiscoveryResultListView(generics.ListAPIView):
    serializer_class = DiscoveryResultSerializer
    filterset_fields = ["is_new", "is_interesting", "is_promoted", "source"]
    search_fields = ["keyword_text"]
    ordering_fields = ["search_volume", "rank_absolute", "keyword_difficulty"]

    def get_queryset(self):
        return DiscoveryResult.objects.filter(
            run_id=self.kwargs["run_pk"],
            client_id=self.kwargs["client_pk"],
        )


class PromoteKeywordsView(APIView):
    def post(self, request, client_pk):
        serializer = PromoteKeywordsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keyword_texts = serializer.validated_data["keyword_texts"]
        now = timezone.now()
        today = now.date()
        created = 0

        # Get the latest discovery results for these keywords
        latest_run = (
            DiscoveryRun.objects.filter(client_id=client_pk, status="completed")
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

            keyword, was_created = Keyword.objects.get_or_create(
                client_id=client_pk,
                keyword_text=text,
                location_code=None,
                defaults={
                    "status": KeywordStatus.TRACKED,
                    "promoted_at": now,
                    "first_discovered_at": today,
                    "search_volume": discovery_result.search_volume if discovery_result else None,
                    "competition": discovery_result.competition if discovery_result else None,
                    "competition_level": discovery_result.competition_level if discovery_result else "",
                    "cpc": discovery_result.cpc if discovery_result else None,
                    "keyword_difficulty": discovery_result.keyword_difficulty if discovery_result else None,
                    "discovery_rank": discovery_result.rank_absolute if discovery_result else None,
                },
            )

            if not was_created and keyword.status != KeywordStatus.TRACKED:
                keyword.status = KeywordStatus.TRACKED
                keyword.promoted_at = now
                keyword.save(update_fields=["status", "promoted_at", "updated_at"])

            if was_created:
                created += 1

            # Mark discovery result as promoted
            if discovery_result:
                discovery_result.is_promoted = True
                discovery_result.save(update_fields=["is_promoted"])

        return Response({"created": created, "total": len(keyword_texts)}, status=status.HTTP_200_OK)
