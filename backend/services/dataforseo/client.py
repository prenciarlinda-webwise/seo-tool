import logging
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .exceptions import DataForSEOAPIError, DataForSEORateLimitError

logger = logging.getLogger(__name__)

BASE_URL = "https://api.dataforseo.com/v3"


class DataForSEOClient:
    """Base HTTP client for DataForSEO API with retry and rate limiting."""

    MIN_REQUEST_INTERVAL = 0.2  # seconds between requests

    def __init__(self, login: str, password: str):
        self.session = requests.Session()
        self.session.auth = (login, password)
        self.session.headers.update({"Content-Type": "application/json"})

        retry = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)

        self._last_request_time = 0.0

    def _rate_limit(self):
        elapsed = time.monotonic() - self._last_request_time
        if elapsed < self.MIN_REQUEST_INTERVAL:
            time.sleep(self.MIN_REQUEST_INTERVAL - elapsed)

    def post(self, endpoint: str, payload: list[dict]) -> dict:
        """Send a POST request to a DataForSEO endpoint.

        Args:
            endpoint: API path after /v3/ (e.g., "serp/google/organic/live/regular")
            payload: List of task dicts as required by the API.

        Returns:
            Parsed JSON response dict.
        """
        url = f"{BASE_URL}/{endpoint}"
        self._rate_limit()

        logger.debug("DataForSEO POST %s with %d task(s)", endpoint, len(payload))
        try:
            resp = self.session.post(url, json=payload, timeout=60)
            self._last_request_time = time.monotonic()
        except requests.RequestException as exc:
            logger.error("DataForSEO request failed: %s", exc)
            raise

        try:
            data = resp.json()
        except ValueError:
            raise DataForSEOAPIError(
                status_code=resp.status_code,
                message=f"Non-JSON response (HTTP {resp.status_code})",
                response={},
            )

        if resp.status_code == 429:
            raise DataForSEORateLimitError("Rate limit exceeded")

        if resp.status_code != 200:
            raise DataForSEOAPIError(
                status_code=resp.status_code,
                message=data.get("status_message", "Unknown error"),
                response=data,
            )

        status_code = data.get("status_code", 0)
        if status_code != 20000:
            raise DataForSEOAPIError(
                status_code=status_code,
                message=data.get("status_message", "Unknown error"),
                response=data,
            )

        return data
