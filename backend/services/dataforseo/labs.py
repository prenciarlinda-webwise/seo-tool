import logging
from typing import Any

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class LabsService:
    """DataForSEO Labs API for keyword discovery and competitive analysis."""

    ENDPOINT = "dataforseo_labs/google/ranked_keywords/live"

    def __init__(self, client: DataForSEOClient):
        self.client = client

    def get_ranked_keywords(
        self,
        target: str,
        location_code: int = 2840,
        language_code: str = "en",
        limit: int = 1000,
        offset: int = 0,
        order_by: str | None = None,
        filters: list | None = None,
    ) -> dict:
        """Get all keywords a domain ranks for.

        Args:
            target: Domain to check (e.g., "acmeplumbing.com")
            location_code: DataForSEO location code
            language_code: Language code
            limit: Max results to return (up to 1000 per call)
            offset: Pagination offset
            order_by: Sort field (e.g., ["ranked_serp_element.serp_item.rank_group,asc"])
            filters: DataForSEO filter array
        """
        task = {
            "target": target,
            "location_code": location_code,
            "language_code": language_code,
            "limit": limit,
            "offset": offset,
        }
        if order_by:
            task["order_by"] = order_by
        if filters:
            task["filters"] = filters

        data = self.client.post(self.ENDPOINT, [task])
        tasks = data.get("tasks", [])
        if not tasks:
            return {}
        return tasks[0]

    @staticmethod
    def parse_ranked_keywords(task_result: dict) -> list[dict]:
        """Parse ranked keywords response into flat list of keyword dicts."""
        keywords = []

        result_data = task_result.get("result", [])
        if not result_data:
            return keywords

        items = result_data[0].get("items", [])
        for item in items or []:
            kw_data = item.get("keyword_data") or {}
            serp_element = item.get("ranked_serp_element") or {}
            serp_item = serp_element.get("serp_item") or {}

            keyword_info = kw_data.get("keyword_info") or {}
            keyword_props = kw_data.get("keyword_properties") or {}
            search_intent = kw_data.get("search_intent_info") or {}
            impression_info = kw_data.get("impression_info") or {}

            keywords.append({
                "keyword": kw_data.get("keyword", ""),
                "rank_absolute": serp_item.get("rank_absolute"),
                "rank_group": serp_item.get("rank_group"),
                "url": serp_item.get("url", ""),
                "search_volume": keyword_info.get("search_volume"),
                "competition": keyword_info.get("competition"),
                "competition_level": keyword_info.get("competition_level", ""),
                "cpc": keyword_info.get("cpc"),
                "keyword_difficulty": keyword_props.get("keyword_difficulty"),
                "estimated_traffic": impression_info.get("estimated_paid_traffic_cost"),
                "monthly_searches": keyword_info.get("monthly_searches"),
                "intent": search_intent.get("main_intent", ""),
            })

        return keywords

    # ------------------------------------------------------------------
    # Helper for new methods
    # ------------------------------------------------------------------

    def _parse_items(self, data: dict) -> tuple[list[dict], int]:
        """Extract items and total_count from a standard response."""
        tasks = data.get("tasks", [])
        if not tasks:
            return [], 0

        result = tasks[0].get("result")
        if not result:
            return [], 0

        first = result[0] if result else {}
        items = first.get("items") or []
        total_count = first.get("total_count", 0)
        return items, total_count

    # ------------------------------------------------------------------
    # Keyword research
    # ------------------------------------------------------------------

    def get_keyword_suggestions(
        self,
        keyword: str,
        location_code: int = 2840,
        language_code: str = "en",
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get keyword suggestions based on a seed keyword.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {
            "keyword": keyword,
            "location_code": location_code,
            "language_code": language_code,
            "limit": limit,
        }
        data = self.client.post(
            "dataforseo_labs/google/keyword_suggestions/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_keyword_ideas(
        self,
        keywords: list[str],
        location_code: int = 2840,
        language_code: str = "en",
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get keyword ideas based on multiple seed keywords.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {
            "keywords": keywords,
            "location_code": location_code,
            "language_code": language_code,
            "limit": limit,
        }
        data = self.client.post(
            "dataforseo_labs/google/keyword_ideas/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_keyword_overview(
        self,
        keywords: list[str],
        location_code: int = 2840,
        language_code: str = "en",
    ) -> dict[str, Any]:
        """Get overview metrics for a list of keywords.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {
            "keywords": keywords,
            "location_code": location_code,
            "language_code": language_code,
        }
        data = self.client.post(
            "dataforseo_labs/google/keyword_overview/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_historical_search_volume(
        self,
        keywords: list[str],
        location_code: int = 2840,
        language_code: str = "en",
    ) -> dict[str, Any]:
        """Get historical search volume for keywords.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {
            "keywords": keywords,
            "location_code": location_code,
            "language_code": language_code,
        }
        data = self.client.post(
            "dataforseo_labs/google/historical_search_volume/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    # ------------------------------------------------------------------
    # Competitive analysis
    # ------------------------------------------------------------------

    def get_competitors_domain(
        self,
        target: str,
        location_code: int = 2840,
        language_code: str = "en",
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get competitor domains for the target domain.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {
            "target": target,
            "location_code": location_code,
            "language_code": language_code,
            "limit": limit,
        }
        data = self.client.post(
            "dataforseo_labs/google/competitors_domain/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_domain_intersection(
        self,
        targets: list[str],
        location_code: int = 2840,
        language_code: str = "en",
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get keywords shared between multiple domains.

        Args:
            targets: List of domains to intersect (2-20 domains).

        Returns:
            Dict with 'items' and 'total_count'.
        """
        # DataForSEO expects targets as a dict with numeric string keys
        targets_dict = {str(i + 1): t for i, t in enumerate(targets)}
        task = {
            "targets": targets_dict,
            "location_code": location_code,
            "language_code": language_code,
            "limit": limit,
        }
        data = self.client.post(
            "dataforseo_labs/google/domain_intersection/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}
