import logging
from datetime import date

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task
def weekly_rank_tracking(client_id=None):
    """Check SERP + Maps rankings for tracked keywords.

    Args:
        client_id: Optional — if provided, only check this client.
                   Otherwise check all active clients.
    """
    from apps.clients.models import Client
    from apps.keywords.models import Keyword, KeywordStatus
    from services.dataforseo import DataForSEOClient, LocalFinderService, MapsService, SERPService
    from services.dataforseo.screenshots import ScreenshotService

    api_client = DataForSEOClient(
        login=settings.DATAFORSEO_LOGIN,
        password=settings.DATAFORSEO_PASSWORD,
    )
    serp_service = SERPService(api_client)
    maps_service = MapsService(api_client)
    local_finder_service = LocalFinderService(api_client)
    screenshot_service = ScreenshotService(api_client)

    today = date.today()
    clients = Client.objects.filter(is_active=True)
    if client_id:
        clients = clients.filter(id=client_id)

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
                    screenshot_service=screenshot_service,
                    local_finder_service=local_finder_service,
                )
                total_checked += 1
            except Exception:
                logger.exception(
                    "Failed to check rankings for keyword=%s client=%s",
                    keyword.keyword_text,
                    client.domain,
                )

    logger.info("Rank tracking complete: %d keywords checked", total_checked)
    return {"keywords_checked": total_checked}


def _store_competitor_positions(client, keyword, task_result, serp_service, today):
    """Extract competitor positions from full SERP data and store in CompetitorKeywordOverlap."""
    from apps.competitors.models import Competitor, CompetitorKeywordOverlap
    from urllib.parse import urlparse

    competitors = Competitor.objects.filter(client=client)
    if not competitors.exists():
        return

    # Build lookup: clean_domain -> competitor
    comp_lookup = {}
    for comp in competitors:
        parsed = urlparse(comp.domain if "://" in comp.domain else f"https://{comp.domain}")
        clean = (parsed.hostname or comp.domain).lower().replace("www.", "").rstrip("/")
        comp_lookup[clean] = comp

    # Extract ALL domain positions from the SERP result
    all_positions = serp_service.extract_all_positions(task_result)

    for clean_domain, comp in comp_lookup.items():
        rank = all_positions.get(clean_domain)
        CompetitorKeywordOverlap.objects.update_or_create(
            client=client,
            competitor=comp,
            date=today,
            keyword_text=keyword.keyword_text,
            defaults={
                "search_volume": keyword.search_volume,
                "client_rank": keyword.current_organic_rank,
                "competitor_rank": rank,
            },
        )


def _check_keyword_rankings(keyword, client, today, serp_service, maps_service, screenshot_service=None, local_finder_service=None):
    """Check organic (and optionally Maps/Local Finder) rankings for a single keyword."""
    from apps.rankings.models import LocalFinderResult, MapsRankResult, SERPResult

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
            SERPResult.objects.filter(keyword=keyword, device="desktop")
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
            device="desktop",
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
                "serp_url": position.get("check_url", ""),
                "dataforseo_task_id": task_result.get("id", ""),
                "dataforseo_cost": task_result.get("cost"),
            },
        )

        # Capture SERP screenshot(s) — multi-page when rank requires it
        if screenshot_service and task_result.get("id"):
            try:
                rank = position["rank_absolute"]
                if rank:
                    screenshots = screenshot_service.capture_serp_pages(
                        task_id=task_result["id"],
                        rank_position=rank,
                        keyword=keyword.keyword_text,
                        location_code=location_code,
                        language_code=language_code,
                        device="desktop",
                    )
                else:
                    page1 = screenshot_service.capture_serp_screenshot(task_result["id"])
                    screenshots = [{"page": 1, "url": page1}] if page1 else []

                if screenshots:
                    serp_result.screenshot_url = screenshots[0]["url"]
                    serp_result.screenshot_urls = screenshots
                    serp_result.save(update_fields=["screenshot_url", "screenshot_urls"])
            except Exception:
                logger.warning("Failed to capture SERP screenshots for keyword=%s", keyword.keyword_text)

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

        # Extract and store competitor positions from the same SERP data
        _store_competitor_positions(
            client=client,
            keyword=keyword,
            task_result=task_result,
            serp_service=serp_service,
            today=today,
        )

    # Mobile organic SERP check
    if client.track_organic and client.track_mobile:
        mobile_task_result = serp_service.check_organic(
            keyword=keyword.keyword_text,
            location_code=location_code,
            language_code=language_code,
            device="mobile",
        )

        if not mobile_task_result:
            logger.warning(
                "Empty mobile SERP result for keyword=%s client=%s",
                keyword.keyword_text,
                client.domain,
            )
            mobile_task_result = {}

        mobile_position = serp_service.find_domain_position(mobile_task_result, client.domain)

        # Get previous mobile result for change tracking
        mobile_previous = (
            SERPResult.objects.filter(keyword=keyword, device="mobile")
            .exclude(checked_at=today)
            .order_by("-checked_at")
            .first()
        )

        mobile_rank_change = None
        mobile_url_changed = False
        mobile_previous_rank = None
        mobile_previous_url = ""
        if mobile_previous and mobile_previous.rank_absolute and mobile_position["rank_absolute"]:
            mobile_previous_rank = mobile_previous.rank_absolute
            mobile_rank_change = mobile_previous_rank - mobile_position["rank_absolute"]
            mobile_url_changed = mobile_previous.url != mobile_position["url"]
            mobile_previous_url = mobile_previous.url
        elif mobile_previous and mobile_previous.rank_absolute and not mobile_position["rank_absolute"]:
            mobile_previous_rank = mobile_previous.rank_absolute
        elif mobile_previous and not mobile_previous.rank_absolute and mobile_position["rank_absolute"]:
            pass

        mobile_serp_result, _ = SERPResult.objects.update_or_create(
            keyword=keyword,
            checked_at=today,
            device="mobile",
            defaults={
                "client": client,
                "rank_absolute": mobile_position["rank_absolute"],
                "rank_group": mobile_position["rank_group"],
                "serp_page": mobile_position["serp_page"],
                "is_found": mobile_position["is_found"],
                "url": mobile_position["url"],
                "title": mobile_position["title"],
                "description": mobile_position["description"],
                "breadcrumb": mobile_position["breadcrumb"],
                "cache_url": mobile_position["cache_url"],
                "rank_change": mobile_rank_change,
                "previous_rank": mobile_previous_rank,
                "url_changed": mobile_url_changed,
                "previous_url": mobile_previous_url,
                "featured_snippet_present": mobile_position["featured_snippet_present"],
                "local_pack_present": mobile_position["local_pack_present"],
                "knowledge_panel_present": mobile_position["knowledge_panel_present"],
                "people_also_ask_present": mobile_position["people_also_ask_present"],
                "video_results_present": mobile_position["video_results_present"],
                "images_present": mobile_position["images_present"],
                "shopping_present": mobile_position["shopping_present"],
                "ai_overview_present": mobile_position["ai_overview_present"],
                "total_results_count": mobile_position["total_results_count"],
                "top_competitors": mobile_position["top_competitors"],
                "serp_url": mobile_position.get("check_url", ""),
                "dataforseo_task_id": mobile_task_result.get("id", ""),
                "dataforseo_cost": mobile_task_result.get("cost"),
            },
        )

        # Capture mobile SERP screenshot(s)
        if screenshot_service and mobile_task_result.get("id"):
            try:
                rank = mobile_position["rank_absolute"]
                if rank:
                    screenshots = screenshot_service.capture_serp_pages(
                        task_id=mobile_task_result["id"],
                        rank_position=rank,
                        keyword=keyword.keyword_text,
                        location_code=location_code,
                        language_code=language_code,
                        device="mobile",
                    )
                else:
                    page1 = screenshot_service.capture_serp_screenshot(mobile_task_result["id"])
                    screenshots = [{"page": 1, "url": page1}] if page1 else []

                if screenshots:
                    mobile_serp_result.screenshot_url = screenshots[0]["url"]
                    mobile_serp_result.screenshot_urls = screenshots
                    mobile_serp_result.save(update_fields=["screenshot_url", "screenshot_urls"])
            except Exception:
                logger.warning("Failed to capture mobile SERP screenshots for keyword=%s", keyword.keyword_text)

        # Update denormalized mobile fields on Keyword
        keyword.previous_mobile_rank = keyword.current_mobile_rank
        keyword.current_mobile_rank = mobile_position["rank_absolute"]
        keyword.current_mobile_url = mobile_position["url"]
        keyword.mobile_rank_change = mobile_rank_change
        keyword.save(update_fields=[
            "previous_mobile_rank", "current_mobile_rank",
            "current_mobile_url", "mobile_rank_change",
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

        maps_result, _ = MapsRankResult.objects.update_or_create(
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
                "serp_url": position.get("check_url", ""),
                "top_competitors": position["top_competitors"],
                "dataforseo_task_id": task_result.get("id", ""),
                "dataforseo_cost": task_result.get("cost"),
            },
        )

        # Capture Maps screenshot
        if screenshot_service and position.get("check_url"):
            try:
                maps_screenshot = screenshot_service.capture_maps_screenshot(
                    position["check_url"],
                )
                if maps_screenshot:
                    maps_result.screenshot_url = maps_screenshot
                    maps_result.save(update_fields=["screenshot_url"])
            except Exception:
                logger.warning(
                    "Failed to capture Maps screenshot for keyword=%s",
                    keyword.keyword_text,
                )

        keyword.previous_maps_rank = keyword.current_maps_rank
        keyword.current_maps_rank = position["rank_group"]
        keyword.save(update_fields=[
            "previous_maps_rank", "current_maps_rank", "updated_at",
        ])

    # Local Finder check
    if client.track_maps and keyword.maps_enabled and local_finder_service:
        task_result = local_finder_service.check_local_finder(
            keyword=keyword.keyword_text,
            location_code=location_code,
            language_code=language_code,
        )

        if not task_result:
            logger.warning(
                "Empty Local Finder result for keyword=%s client=%s",
                keyword.keyword_text,
                client.domain,
            )
            task_result = {}

        position = local_finder_service.find_business_position(
            task_result,
            domain=client.domain,
            place_id=client.google_place_id,
            business_name=client.google_business_name,
        )

        previous = (
            LocalFinderResult.objects.filter(keyword=keyword)
            .exclude(checked_at=today)
            .order_by("-checked_at")
            .first()
        )

        finder_rank_change = None
        finder_previous_rank = None

        if previous:
            finder_previous_rank = previous.rank
            if previous.rank and position["rank"]:
                finder_rank_change = previous.rank - position["rank"]

        finder_result, _ = LocalFinderResult.objects.update_or_create(
            keyword=keyword,
            checked_at=today,
            defaults={
                "client": client,
                "rank": position["rank"],
                "is_found": position["is_found"],
                "title": position["title"],
                "domain": position["domain"],
                "url": position["url"],
                "phone": position["phone"],
                "address": position["address"],
                "place_id": position["place_id"],
                "cid": position["cid"],
                "rating_value": position["rating_value"],
                "rating_count": position["rating_count"],
                "category": position["category"],
                "serp_url": position.get("check_url", ""),
                "rank_change": finder_rank_change,
                "previous_rank": finder_previous_rank,
                "dataforseo_task_id": task_result.get("id", ""),
                "dataforseo_cost": task_result.get("cost"),
            },
        )

        # Capture Local Finder screenshot
        if screenshot_service and position.get("check_url"):
            try:
                finder_screenshot = screenshot_service.capture_maps_screenshot(
                    position["check_url"],
                )
                if finder_screenshot:
                    finder_result.screenshot_url = finder_screenshot
                    finder_result.save(update_fields=["screenshot_url"])
            except Exception:
                logger.warning(
                    "Failed to capture Local Finder screenshot for keyword=%s",
                    keyword.keyword_text,
                )
