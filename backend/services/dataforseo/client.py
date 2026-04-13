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

        # Only retry on 429 and 502/503 — NOT 500/504 (those indicate real errors)
        retry = Retry(
            total=2,
            backoff_factor=0.5,
            status_forcelist=[429, 502, 503],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)

        self._last_request_time = 0.0

    def _rate_limit(self):
        elapsed = time.monotonic() - self._last_request_time
        if elapsed < self.MIN_REQUEST_INTERVAL:
            time.sleep(self.MIN_REQUEST_INTERVAL - elapsed)

    def _check_response(self, resp: requests.Response) -> dict:
        """Parse and validate a DataForSEO API response."""
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

        # Check individual task statuses first — they have the most specific errors
        for task in data.get("tasks") or []:
            task_status = task.get("status_code", 20000)
            task_message = task.get("status_message", "")

            if task_status == 40200:
                raise DataForSEOAPIError(
                    status_code=40200,
                    message=f"Insufficient balance — {task_message}. Top up your DataForSEO account.",
                    response=data,
                )
            if task_status == 40204:
                raise DataForSEOAPIError(
                    status_code=40204,
                    message=f"Subscription required for this API: {task_message}",
                    response=data,
                )
            if task_status >= 40000:
                raise DataForSEOAPIError(
                    status_code=task_status,
                    message=task_message,
                    response=data,
                )

        # Check HTTP-level errors (non-200 that aren't covered by task errors)
        if resp.status_code != 200:
            raise DataForSEOAPIError(
                status_code=resp.status_code,
                message=data.get("status_message", "Unknown error"),
                response=data,
            )

        # Check top-level API status
        status_code = data.get("status_code", 0)
        if status_code != 20000:
            raise DataForSEOAPIError(
                status_code=status_code,
                message=data.get("status_message", "Unknown error"),
                response=data,
            )

        return data

    def post(self, endpoint: str, payload: list[dict], timeout: int = 30) -> dict:
        url = f"{BASE_URL}/{endpoint}"
        self._rate_limit()

        logger.debug("DataForSEO POST %s with %d task(s)", endpoint, len(payload))
        try:
            resp = self.session.post(url, json=payload, timeout=timeout)
            self._last_request_time = time.monotonic()
        except requests.Timeout:
            logger.error("DataForSEO timeout: %s", endpoint)
            raise DataForSEOAPIError(504, f"Timeout calling {endpoint}", {})
        except requests.RequestException as exc:
            logger.error("DataForSEO request failed: %s", exc)
            raise

        return self._check_response(resp)

    def get(self, endpoint: str) -> dict:
        url = f"{BASE_URL}/{endpoint}"
        self._rate_limit()

        logger.debug("DataForSEO GET %s", endpoint)
        try:
            resp = self.session.get(url, timeout=30)
            self._last_request_time = time.monotonic()
        except requests.Timeout:
            logger.error("DataForSEO timeout: %s", endpoint)
            raise DataForSEOAPIError(504, f"Timeout calling {endpoint}", {})
        except requests.RequestException as exc:
            logger.error("DataForSEO request failed: %s", exc)
            raise

        return self._check_response(resp)
