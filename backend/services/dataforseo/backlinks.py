import logging
from typing import Any

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class BacklinksService:
    """DataForSEO Backlinks API for link analysis."""

    def __init__(self, client: DataForSEOClient):
        self.client = client

    def _parse_response(self, data: dict) -> tuple[list[dict], int]:
        """Extract items and total_count from a standard DataForSEO response.

        Returns:
            Tuple of (items list, total_count).
        """
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

    def get_summary(self, target: str) -> dict[str, Any]:
        """Get a backlink summary for the target domain/URL.

        Args:
            target: Domain or URL to analyse (e.g., "example.com").

        Returns:
            Dict with total_backlinks, referring_domains, rank, etc.
        """
        data = self.client.post("backlinks/summary/live", [{"target": target}])

        tasks = data.get("tasks", [])
        if not tasks:
            logger.warning("No tasks returned for backlinks summary target=%s", target)
            return {}

        result = tasks[0].get("result")
        if not result:
            logger.warning("No result for backlinks summary target=%s", target)
            return {}

        return result[0] if result else {}

    def get_backlinks(
        self,
        target: str,
        limit: int = 100,
        offset: int = 0,
        order_by: list[str] | None = None,
        filters: list | None = None,
    ) -> dict[str, Any]:
        """Get individual backlinks pointing to the target.

        Returns:
            Dict with 'items' (list of backlink dicts) and 'total_count'.
        """
        task: dict = {
            "target": target,
            "limit": limit,
            "offset": offset,
        }
        if order_by:
            task["order_by"] = order_by
        if filters:
            task["filters"] = filters

        data = self.client.post("backlinks/backlinks/live", [task])
        items, total_count = self._parse_response(data)
        return {"items": items, "total_count": total_count}

    def get_referring_domains(
        self,
        target: str,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get referring domains for the target.

        Returns:
            Dict with 'items' (list of domain dicts) and 'total_count'.
        """
        task = {
            "target": target,
            "limit": limit,
            "offset": offset,
        }
        data = self.client.post("backlinks/referring_domains/live", [task])
        items, total_count = self._parse_response(data)
        return {"items": items, "total_count": total_count}

    def get_anchors(
        self,
        target: str,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get anchor text distribution for backlinks to the target.

        Returns:
            Dict with 'items' (list of anchor dicts) and 'total_count'.
        """
        task = {
            "target": target,
            "limit": limit,
            "offset": offset,
        }
        data = self.client.post("backlinks/anchors/live", [task])
        items, total_count = self._parse_response(data)
        return {"items": items, "total_count": total_count}

    def get_history(self, target: str) -> dict[str, Any]:
        """Get historical backlink data for the target.

        Returns:
            Dict with 'items' (list of historical snapshots) and 'total_count'.
        """
        data = self.client.post("backlinks/history/live", [{"target": target}])
        items, total_count = self._parse_response(data)
        return {"items": items, "total_count": total_count}

    def get_new_lost_summary(self, target: str) -> dict[str, Any]:
        """Get new/lost backlinks time-series summary.

        Returns:
            Dict with 'items' (list of time-series entries) and 'total_count'.
        """
        data = self.client.post(
            "backlinks/timeseries_new_lost_summary/live",
            [{"target": target}],
        )
        items, total_count = self._parse_response(data)
        return {"items": items, "total_count": total_count}
