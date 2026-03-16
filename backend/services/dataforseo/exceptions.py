class DataForSEOError(Exception):
    """Base exception for DataForSEO errors."""


class DataForSEOAPIError(DataForSEOError):
    """Error returned by the DataForSEO API."""

    def __init__(self, status_code, message, response=None):
        self.status_code = status_code
        self.response = response
        super().__init__(f"DataForSEO API error {status_code}: {message}")


class DataForSEORateLimitError(DataForSEOError):
    """Rate limit exceeded."""
