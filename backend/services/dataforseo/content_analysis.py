import logging
from typing import Any

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class ContentAnalysisService:
    """DataForSEO Content Analysis API for keyword-level content insights."""

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

    def search(
        self,
        keyword: str,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Search for content mentioning a keyword.

        Args:
            keyword: Keyword to search for.
            limit: Max number of results.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {"keyword": keyword, "limit": limit}
        data = self.client.post("content_analysis/search/live", [task])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_summary(self, keyword: str) -> dict:
        """Get a content analysis summary for a keyword.

        Args:
            keyword: Keyword to analyse.

        Returns:
            Summary dict with aggregated content metrics.
        """
        data = self.client.post(
            "content_analysis/summary/live",
            [{"keyword": keyword}],
        )
        return self._parse_first_result(data)

    def get_sentiment(self, keyword: str) -> dict:
        """Get sentiment analysis for content mentioning a keyword.

        Args:
            keyword: Keyword to analyse.

        Returns:
            Sentiment analysis result dict.
        """
        data = self.client.post(
            "content_analysis/sentiment_analysis/live",
            [{"keyword": keyword}],
        )
        return self._parse_first_result(data)

    def get_phrase_trends(self, keyword: str) -> dict:
        """Get phrase trends over time for a keyword.

        Args:
            keyword: Keyword to analyse.

        Returns:
            Phrase trends result dict.
        """
        data = self.client.post(
            "content_analysis/phrase_trends/live",
            [{"keyword": keyword}],
        )
        return self._parse_first_result(data)
