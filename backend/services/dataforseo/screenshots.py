import logging

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class ScreenshotService:
    """DataForSEO screenshot capture for SERPs and web pages."""

    def __init__(self, client: DataForSEOClient):
        self.client = client

    def capture_serp_screenshot(self, task_id: str) -> str | None:
        """Capture a screenshot of a SERP result.

        Args:
            task_id: The task ID from a previous SERP task.

        Returns:
            Screenshot URL, or None if unavailable.
        """
        payload = [{"task_id": task_id}]
        data = self.client.post("serp/screenshot", payload)

        tasks = data.get("tasks") or []
        if not tasks:
            logger.warning("No tasks returned for SERP screenshot task_id=%s", task_id)
            return None

        result = tasks[0].get("result")
        if not result:
            logger.warning("No result for SERP screenshot task_id=%s", task_id)
            return None

        # Result contains items_count and items list with image URLs
        items = result[0].get("items") or []
        if items:
            return items[0].get("image")
        return None

    def capture_page_screenshot(
        self,
        url: str,
        full_page: bool = True,
        browser_preset: str | None = None,
    ) -> str | None:
        """Capture a screenshot of a web page via the OnPage API.

        Args:
            url: The URL of the page to screenshot.
            full_page: Whether to capture the full page or just the viewport.
            browser_preset: Optional browser preset (e.g., "desktop", "mobile").

        Returns:
            Screenshot image URL, or None if unavailable.
        """
        task: dict = {
            "url": url,
            "full_page_screenshot": full_page,
        }
        if browser_preset:
            task["browser_preset"] = browser_preset

        data = self.client.post("on_page/page_screenshot", [task], timeout=60)

        tasks = data.get("tasks", [])
        if not tasks:
            logger.warning("No tasks returned for page screenshot url=%s", url)
            return None

        result = tasks[0].get("result")
        if not result:
            logger.warning("No result for page screenshot url=%s", url)
            return None

        return result[0].get("image") or result[0].get("url")

    def capture_serp_pages(
        self,
        task_id: str,
        rank_position: int,
        keyword: str,
        location_code: int,
        language_code: str,
        device: str = "desktop",
        max_pages: int = 5,
    ) -> list[dict]:
        """Capture SERP screenshots for all pages up to the rank position.

        Uses the DataForSEO SERP API with offset for pages 2+, ensuring
        location-accurate results from the API (not browser scraping).

        Args:
            task_id: SERP task ID from page 1 (for native screenshot).
            rank_position: The keyword's rank position.
            keyword: The keyword to search.
            location_code: DataForSEO location code.
            language_code: Language code.
            device: "desktop" or "mobile".
            max_pages: Maximum pages to capture.

        Returns:
            List of {"page": int, "url": str} dicts.
        """
        pages_needed = min(((rank_position - 1) // 10) + 1, max_pages)
        screenshots = []

        # Page 1: use native SERP screenshot from existing task
        page1_url = self.capture_serp_screenshot(task_id)
        if page1_url:
            screenshots.append({"page": 1, "url": page1_url})

        # Pages 2+: make new SERP API calls with offset, then screenshot those tasks
        if pages_needed > 1:
            for page in range(2, pages_needed + 1):
                try:
                    offset = (page - 1) * 10
                    payload = [{
                        "keyword": keyword,
                        "location_code": location_code,
                        "language_code": language_code,
                        "device": device,
                        "depth": 10,
                        "offset": offset,
                    }]
                    data = self.client.post("serp/google/organic/live/regular", payload)
                    tasks = data.get("tasks") or []
                    if tasks and tasks[0].get("id"):
                        page_task_id = tasks[0]["id"]
                        img_url = self.capture_serp_screenshot(page_task_id)
                        if img_url:
                            screenshots.append({"page": page, "url": img_url})
                except Exception:
                    logger.warning(
                        "Failed to capture SERP screenshot page %d for keyword=%s",
                        page, keyword,
                    )

        return screenshots

    def capture_maps_screenshot(self, check_url: str) -> str | None:
        """Capture a screenshot of a Google Maps SERP result.

        Maps tasks don't support serp/screenshot, so we use page_screenshot
        with the Maps check_url (which includes location via uule param).

        Args:
            check_url: Google Maps SERP URL from the API response.

        Returns:
            Screenshot URL, or None.
        """
        if not check_url:
            return None
        return self.capture_page_screenshot(url=check_url, full_page=True)
