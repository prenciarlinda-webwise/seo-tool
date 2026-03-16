import logging
from datetime import date

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task
def weekly_rank_tracking():
    """Check SERP + Maps rankings for all tracked keywords across active clients."""
    from apps.clients.models import Client
    from apps.keywords.models import Keyword, KeywordStatus
    from apps.rankings.models import MapsRankResult, SERPResult
    from services.dataforseo import DataForSEOClient, MapsService, SERPService

    api_client = DataForSEOClient(
        login=settings.DATAFORSEO_LOGIN,
        password=settings.DATAFORSEO_PASSWORD,
    )
    serp_service = SERPService(api_client)
    maps_service = MapsService(api_client)

    today = date.today()
    clients = Client.objects.filter(is_active=True)
    total_checked = 0

    for client in clients:
        keywords = Keyword.objects.filter(
            client=client,
            status=KeywordStatus.TRACKED,
        )

        for keyword in keywords:
            try:
                _check_keyword_rankings(
                    keyword=keyword,
                    client=client,
                    today=today,
                    serp_service=serp_service,
                    maps_service=maps_service,
                )
                total_checked += 1
            except Exception:
                logger.exception(
                    "Failed to check rankings for keyword=%s client=%s",
                    keyword.keyword_text,
                    client.domain,
                )

    logger.info("Weekly rank tracking complete: %d keywords checked", total_checked)
    return {"keywords_checked": total_checked}


def _check_keyword_rankings(keyword, client, today, serp_service, maps_service):
    """Check organic (and optionally Maps) rankings for a single keyword."""
    from apps.rankings.models import MapsRankResult, SERPResult

    location_code = keyword.effective_location_code
    language_code = keyword.effective_language_code

    # Organic SERP check
    if client.track_organic:
        task_result = serp_service.check_organic(
            keyword=keyword.keyword_text,
            location_code=location_code,
            language_code=language_code,
        )

        if not task_result:
            logger.warning(
                "Empty SERP result for keyword=%s client=%s",
                keyword.keyword_text,
                client.domain,
            )
            task_result = {}

        position = serp_service.find_domain_position(task_result, client.domain)

        # Get previous result for change tracking
        previous = (
            SERPResult.objects.filter(keyword=keyword)
            .exclude(checked_at=today)
            .order_by("-checked_at")
            .first()
        )

        rank_change = None
        url_changed = False
        previous_rank = None
        previous_url = ""
        if previous and previous.rank_absolute and position["rank_absolute"]:
            previous_rank = previous.rank_absolute
            rank_change = previous_rank - position["rank_absolute"]  # positive = improved
            url_changed = previous.url != position["url"]
            previous_url = previous.url
        elif previous and previous.rank_absolute and not position["rank_absolute"]:
            previous_rank = previous.rank_absolute
        elif previous and not previous.rank_absolute and position["rank_absolute"]:
            pass

        serp_result, _ = SERPResult.objects.update_or_create(
            keyword=keyword,
            checked_at=today,
            defaults={
                "client": client,
                "rank_absolute": position["rank_absolute"],
                "rank_group": position["rank_group"],
                "serp_page": position["serp_page"],
                "is_found": position["is_found"],
                "url": position["url"],
                "title": position["title"],
                "description": position["description"],
                "breadcrumb": position["breadcrumb"],
                "cache_url": position["cache_url"],
                "rank_change": rank_change,
                "previous_rank": previous_rank,
                "url_changed": url_changed,
                "previous_url": previous_url,
                "featured_snippet_present": position["featured_snippet_present"],
                "local_pack_present": position["local_pack_present"],
                "knowledge_panel_present": position["knowledge_panel_present"],
                "people_also_ask_present": position["people_also_ask_present"],
                "video_results_present": position["video_results_present"],
                "images_present": position["images_present"],
                "shopping_present": position["shopping_present"],
                "ai_overview_present": position["ai_overview_present"],
                "total_results_count": position["total_results_count"],
                "top_competitors": position["top_competitors"],
                "dataforseo_task_id": task_result.get("id", ""),
                "dataforseo_cost": task_result.get("cost"),
            },
        )

        # Update denormalized fields on Keyword
        keyword.previous_organic_rank = keyword.current_organic_rank
        keyword.current_organic_rank = position["rank_absolute"]
        keyword.current_organic_url = position["url"]
        keyword.rank_change = rank_change
        keyword.last_checked_at = today
        keyword.save(update_fields=[
            "previous_organic_rank", "current_organic_rank",
            "current_organic_url", "rank_change", "last_checked_at",
            "updated_at",
        ])

    # Maps check
    if client.track_maps and keyword.maps_enabled:
        task_result = maps_service.check_maps(
            keyword=keyword.keyword_text,
            location_code=location_code,
            language_code=language_code,
        )

        if not task_result:
            logger.warning(
                "Empty Maps result for keyword=%s client=%s",
                keyword.keyword_text,
                client.domain,
            )
            task_result = {}

        position = maps_service.find_business_position(
            task_result,
            domain=client.domain,
            place_id=client.google_place_id,
            business_name=client.google_business_name,
        )

        previous = (
            MapsRankResult.objects.filter(keyword=keyword)
            .exclude(checked_at=today)
            .order_by("-checked_at")
            .first()
        )

        maps_rank_change = None
        maps_previous_rank = None
        rating_change = None
        review_count_change = None

        if previous:
            maps_previous_rank = previous.rank_group
            if previous.rank_group and position["rank_group"]:
                maps_rank_change = previous.rank_group - position["rank_group"]
            if previous.rating_value and position["rating_value"]:
                rating_change = position["rating_value"] - previous.rating_value
            if previous.rating_count and position["rating_count"]:
                review_count_change = position["rating_count"] - previous.rating_count

        MapsRankResult.objects.update_or_create(
            keyword=keyword,
            checked_at=today,
            defaults={
                "client": client,
                "rank_group": position["rank_group"],
                "rank_absolute": position["rank_absolute"],
                "is_found": position["is_found"],
                "title": position["title"],
                "domain": position["domain"],
                "url": position["url"],
                "phone": position["phone"],
                "address": position["address"],
                "latitude": position["latitude"],
                "longitude": position["longitude"],
                "place_id": position["place_id"],
                "cid": position["cid"],
                "feature_id": position["feature_id"],
                "rating_value": position["rating_value"],
                "rating_count": position["rating_count"],
                "rating_change": rating_change,
                "review_count_change": review_count_change,
                "category": position["category"],
                "work_hours": position["work_hours"],
                "is_claimed": position["is_claimed"],
                "rank_change": maps_rank_change,
                "previous_rank": maps_previous_rank,
                "top_competitors": position["top_competitors"],
                "dataforseo_task_id": task_result.get("id", ""),
                "dataforseo_cost": task_result.get("cost"),
            },
        )

        keyword.previous_maps_rank = keyword.current_maps_rank
        keyword.current_maps_rank = position["rank_group"]
        keyword.save(update_fields=[
            "previous_maps_rank", "current_maps_rank", "updated_at",
        ])
