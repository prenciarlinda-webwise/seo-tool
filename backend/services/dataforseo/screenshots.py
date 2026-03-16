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

        tasks = data.get("tasks", [])
        if not tasks:
            logger.warning("No tasks returned for SERP screenshot task_id=%s", task_id)
            return None

        result = tasks[0].get("result")
        if not result:
            logger.warning("No result for SERP screenshot task_id=%s", task_id)
            return None

        return result[0].get("image") or result[0].get("url")

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

        data = self.client.post("on_page/page_screenshot", [task])

        tasks = data.get("tasks", [])
        if not tasks:
            logger.warning("No tasks returned for page screenshot url=%s", url)
            return None

        result = tasks[0].get("result")
        if not result:
            logger.warning("No result for page screenshot url=%s", url)
            return None

        return result[0].get("image") or result[0].get("url")
