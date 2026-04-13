import logging
from datetime import date

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Auto-flag thresholds
INTERESTING_MIN_VOLUME = 100
INTERESTING_MAX_RANK = 30


@shared_task
def monthly_keyword_discovery(client_id=None):
    """Run DataForSEO Ranked Keywords for discovery-enabled clients.

    Args:
        client_id: Optional — if provided, only run for this client.
                   Otherwise run for all active, discovery-enabled clients.
    """
    from apps.clients.models import Client

    clients = Client.objects.filter(is_active=True, discovery_enabled=True)
    if client_id:
        clients = clients.filter(id=client_id)

    results_summary = []

    for client in clients:
        try:
            summary = _discover_keywords_for_client(client)
            results_summary.append(summary)
        except Exception:
            logger.exception("Discovery failed for client=%s", client.domain)
            results_summary.append({
                "client": client.domain,
                "status": "failed",
            })

    logger.info("Monthly discovery complete for %d clients", len(results_summary))
    return results_summary


def _discover_keywords_for_client(client):
    """Run keyword discovery for a single client."""
    from apps.discovery.models import DiscoveryResult, DiscoveryRun
    from apps.keywords.models import Keyword
    from services.dataforseo import DataForSEOClient, LabsService

    api_client = DataForSEOClient(
        login=settings.DATAFORSEO_LOGIN,
        password=settings.DATAFORSEO_PASSWORD,
    )
    labs_service = LabsService(api_client)

    today = date.today()
    # Delete existing run for today if re-running
    DiscoveryRun.objects.filter(client=client, run_date=today).delete()
    run = DiscoveryRun.objects.create(
        client=client,
        run_date=today,
        status="running",
    )

    try:
        # Labs API only supports country-level locations (e.g. 2840 for US).
        # City-level codes (1000000+) cause errors, so fall back to US.
        labs_location = client.location_code if client.location_code < 100000 else 2840

        task_result = labs_service.get_ranked_keywords(
            target=client.domain,
            location_code=labs_location,
            language_code=client.language_code,
            limit=client.max_discovery_keywords,
        )

        if not task_result:
            logger.warning(
                "Empty ranked keywords result for client=%s", client.domain,
            )
            task_result = {}

        keywords_data = LabsService.parse_ranked_keywords(task_result)

        # Get existing keyword texts for this client
        existing_keywords = set(
            Keyword.objects.filter(client=client).values_list("keyword_text", flat=True)
        )

        # Previous run's keyword texts for is_new detection
        previous_run = (
            DiscoveryRun.objects.filter(client=client, status="completed")
            .exclude(pk=run.pk)
            .order_by("-run_date")
            .first()
        )
        previous_keywords = set()
        if previous_run:
            previous_keywords = set(
                DiscoveryResult.objects.filter(run=previous_run)
                .values_list("keyword_text", flat=True)
            )

        discovery_results = []
        stats = {
            "total": 0,
            "new": 0,
            "top_10": 0,
            "top_20": 0,
            "top_100": 0,
            "total_traffic": 0.0,
            "rank_sum": 0,
            "rank_count": 0,
        }

        for kw in keywords_data:
            keyword_text = kw["keyword"]
            if not keyword_text:
                continue

            is_new = keyword_text not in previous_keywords and keyword_text not in existing_keywords
            rank = kw["rank_absolute"]
            volume = kw["search_volume"] or 0

            is_interesting = (
                volume >= INTERESTING_MIN_VOLUME
                and rank is not None
                and rank <= INTERESTING_MAX_RANK
            )

            discovery_results.append(DiscoveryResult(
                run=run,
                client=client,
                keyword_text=keyword_text,
                rank_absolute=rank,
                url=kw.get("url") or "",
                search_volume=kw.get("search_volume"),
                competition=kw.get("competition"),
                competition_level=kw.get("competition_level") or "",
                cpc=kw.get("cpc"),
                estimated_traffic=kw.get("estimated_traffic"),
                keyword_difficulty=kw.get("keyword_difficulty"),
                monthly_searches=kw.get("monthly_searches"),
                is_new=is_new,
                is_interesting=is_interesting,
            ))

            stats["total"] += 1
            if is_new:
                stats["new"] += 1
            if rank is not None:
                if rank <= 10:
                    stats["top_10"] += 1
                if rank <= 20:
                    stats["top_20"] += 1
                if rank <= 100:
                    stats["top_100"] += 1
                stats["rank_sum"] += rank
                stats["rank_count"] += 1
            stats["total_traffic"] += kw["estimated_traffic"] or 0

        DiscoveryResult.objects.bulk_create(discovery_results, batch_size=500)

        run.total_keywords_found = stats["total"]
        run.new_keywords_found = stats["new"]
        run.keywords_in_top_10 = stats["top_10"]
        run.keywords_in_top_20 = stats["top_20"]
        run.keywords_in_top_100 = stats["top_100"]
        run.total_estimated_traffic = stats["total_traffic"]
        run.avg_position = (
            stats["rank_sum"] / stats["rank_count"] if stats["rank_count"] else None
        )
        run.dataforseo_task_id = task_result.get("id", "")
        run.dataforseo_cost = task_result.get("cost")
        run.status = "completed"
        run.save()

        logger.info(
            "Discovery for %s: %d total, %d new, %d interesting",
            client.domain,
            stats["total"],
            stats["new"],
            sum(1 for r in discovery_results if r.is_interesting),
        )

        return {
            "client": client.domain,
            "status": "completed",
            "total": stats["total"],
            "new": stats["new"],
        }

    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.save()
        raise
