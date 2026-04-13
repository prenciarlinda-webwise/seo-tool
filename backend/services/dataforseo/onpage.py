import logging
from typing import Any

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class OnPageService:
    """DataForSEO On-Page API for site auditing and Lighthouse."""

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

    # ------------------------------------------------------------------
    # Crawl lifecycle
    # ------------------------------------------------------------------

    def start_crawl(
        self,
        target: str,
        max_pages: int = 200,
        start_url: str | None = None,
        custom_js: str | None = None,
        enable_javascript: bool = False,
        load_resources: bool = False,
    ) -> str | None:
        """Start an on-page crawl for the target site.

        Args:
            target: Domain or URL to crawl (e.g., "example.com").
            max_pages: Maximum number of pages to crawl.
            start_url: Optional specific start URL.
            custom_js: Optional custom JavaScript to execute.
            enable_javascript: Whether to render JS during crawl.
            load_resources: Whether to load page resources.

        Returns:
            Task ID string, or None if the task could not be created.
        """
        task: dict[str, Any] = {
            "target": target,
            "max_crawl_pages": max_pages,
            "enable_javascript": enable_javascript,
            "load_resources": load_resources,
        }
        if start_url:
            task["start_url"] = start_url
        if custom_js:
            task["custom_js"] = custom_js

        data = self.client.post("on_page/task_post", [task])

        tasks = data.get("tasks", [])
        if not tasks:
            logger.warning("No tasks returned for on_page crawl target=%s", target)
            return None

        return tasks[0].get("id")

    def get_crawl_summary(self, task_id: str) -> dict:
        """Get the crawl summary for a completed task.

        Args:
            task_id: The task ID returned by start_crawl.

        Returns:
            Summary dict with crawl statistics.
        """
        data = self.client.get(f"on_page/summary/{task_id}")
        return self._parse_first_result(data)

    # ------------------------------------------------------------------
    # Crawl result endpoints
    # ------------------------------------------------------------------

    def get_pages(
        self,
        task_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Get audited pages from a crawl.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {"id": task_id, "limit": limit, "offset": offset}
        data = self.client.post("on_page/pages", [task])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_resources(
        self,
        task_id: str,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get resources discovered during a crawl.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {"id": task_id, "limit": limit}
        data = self.client.post("on_page/resources", [task])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_duplicate_tags(self, task_id: str) -> dict[str, Any]:
        """Get pages with duplicate title/description tags.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        data = self.client.post("on_page/duplicate_tags", [{"id": task_id}])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_duplicate_content(self, task_id: str) -> dict[str, Any]:
        """Get pages with duplicate content.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        data = self.client.post("on_page/duplicate_content", [{"id": task_id}])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_links(
        self,
        task_id: str,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get internal/external links discovered during a crawl.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        task = {"id": task_id, "limit": limit}
        data = self.client.post("on_page/links", [task])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_non_indexable(self, task_id: str) -> dict[str, Any]:
        """Get non-indexable pages from a crawl.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        data = self.client.post("on_page/non_indexable", [{"id": task_id}])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    def get_redirect_chains(self, task_id: str) -> dict[str, Any]:
        """Get redirect chains discovered during a crawl.

        Returns:
            Dict with 'items' and 'total_count'.
        """
        data = self.client.post("on_page/redirect_chains", [{"id": task_id}])
        items, total_count = self._parse_items(data)
        return {"items": items, "total_count": total_count}

    # ------------------------------------------------------------------
    # Instant page scrape
    # ------------------------------------------------------------------

    def get_instant_page(self, url: str) -> dict:
        """Fetch a page instantly and return its content/meta.

        Uses the DataForSEO On-Page Instant Pages endpoint to scrape
        a single URL and return its HTML content, title, etc.

        Args:
            url: The page URL to scrape.

        Returns:
            Dict with page data (content, title, status_code, etc.),
            or empty dict if not available.
        """
        task = {"url": url, "enable_javascript": False}
        data = self.client.post("on_page/instant_pages", [task])
        result = self._parse_first_result(data)
        if not result:
            return {}
        items = result.get("items") or []
        return items[0] if items else {}

    # ------------------------------------------------------------------
    # Lighthouse
    # ------------------------------------------------------------------

    def run_lighthouse(
        self,
        url: str,
        for_mobile: bool = True,
        categories: list[str] | None = None,
    ) -> dict:
        """Run a Lighthouse audit on a URL.

        Args:
            url: Page URL to audit.
            for_mobile: Run audit as mobile device (True) or desktop (False).
            categories: Lighthouse categories to include
                        (e.g., ["performance", "seo", "accessibility"]).

        Returns:
            Lighthouse audit result dict.
        """
        task: dict[str, Any] = {
            "url": url,
            "for_mobile": for_mobile,
        }
        if categories:
            task["categories"] = categories

        data = self.client.post("on_page/lighthouse/live/json", [task])
        return self._parse_first_result(data)
