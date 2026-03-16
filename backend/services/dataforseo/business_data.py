import logging
from typing import Any

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class BusinessDataService:
    """DataForSEO Business Data API for Google My Business and reviews."""

    def __init__(self, client: DataForSEOClient):
        self.client = client

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

    def _parse_first_result(self, data: dict) -> dict:
        """Extract the first result object from a response."""
        tasks = data.get("tasks", [])
        if not tasks:
            return {}
        result = tasks[0].get("result")
        if not result:
            return {}
        return result[0] if result else {}

    def get_business_info(
        self,
        keyword: str,
        location_code: int = 2840,
    ) -> dict[str, Any]:
        """Get Google My Business info for a keyword/business name.

        Args:
            keyword: Business name or keyword to search.
            location_code: DataForSEO location code (default: US).

        Returns:
            Business info dict.
        """
        task = {
            "keyword": keyword,
            "location_code": location_code,
        }
        data = self.client.post(
            "business_data/google/my_business_info/live", [task]
        )
        return self._parse_first_result(data)

    def get_reviews(
        self,
        keyword: str,
        location_code: int = 2840,
        depth: int = 100,
        sort_by: str = "newest",
    ) -> str | None:
        """Post a task to retrieve Google reviews (async).

        Args:
            keyword: Business name or keyword.
            location_code: DataForSEO location code.
            depth: Number of reviews to retrieve.
            sort_by: Sort order ("newest", "most_relevant", "highest_rating", "lowest_rating").

        Returns:
            Task ID to pass to get_reviews_results(), or None.
        """
        task = {
            "keyword": keyword,
            "location_code": location_code,
            "depth": depth,
            "sort_by": sort_by,
        }
        data = self.client.post(
            "business_data/google/reviews/task_post", [task]
        )

        tasks = data.get("tasks", [])
        if not tasks:
            logger.warning("No tasks returned for reviews keyword=%s", keyword)
            return None

        return tasks[0].get("id")

    def get_reviews_results(self, task_id: str) -> dict[str, Any]:
        """Retrieve results for a previously posted reviews task.

        Args:
            task_id: Task ID from get_reviews().

        Returns:
            Dict with 'items' (list of review dicts) and 'total_count'.
        """
        data = self.client.post(
            "business_data/google/reviews/task_get", [{"id": task_id}]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_reviews_live(
        self,
        keyword: str,
        location_code: int = 2840,
        depth: int = 100,
    ) -> dict[str, Any]:
        """Get Google reviews synchronously (live endpoint).

        Args:
            keyword: Business name or keyword.
            location_code: DataForSEO location code.
            depth: Number of reviews to retrieve.

        Returns:
            Dict with 'items' (list of review dicts) and 'total_count'.
        """
        task = {
            "keyword": keyword,
            "location_code": location_code,
            "depth": depth,
        }
        data = self.client.post(
            "business_data/google/reviews/live", [task]
        )
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}
