import logging
from urllib.parse import urlparse

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class SERPService:
    """Organic SERP rank checking via DataForSEO."""

    ENDPOINT = "serp/google/organic/live/regular"

    def __init__(self, client: DataForSEOClient):
        self.client = client

    def check_organic(
        self,
        keyword: str,
        location_code: int = 2840,
        language_code: str = "en",
        depth: int = 100,
    ) -> dict:
        """Run a live organic SERP check for a single keyword.

        Returns the full task result dict from DataForSEO.
        """
        payload = [
            {
                "keyword": keyword,
                "location_code": location_code,
                "language_code": language_code,
                "depth": depth,
            }
        ]

        data = self.client.post(self.ENDPOINT, payload)
        tasks = data.get("tasks", [])
        if not tasks:
            return {}
        return tasks[0]

    @staticmethod
    def find_domain_position(task_result: dict, domain: str) -> dict:
        """Extract ranking position for a domain from SERP results.

        Returns dict with rank info, SERP features, and top competitors.
        """
        result = {
            "is_found": False,
            "rank_absolute": None,
            "rank_group": None,
            "url": "",
            "title": "",
            "description": "",
            "breadcrumb": "",
            "cache_url": "",
            "serp_page": None,
            "featured_snippet_present": False,
            "local_pack_present": False,
            "knowledge_panel_present": False,
            "people_also_ask_present": False,
            "video_results_present": False,
            "images_present": False,
            "shopping_present": False,
            "ai_overview_present": False,
            "total_results_count": None,
            "top_competitors": [],
        }

        result_data = task_result.get("result", [])
        if not result_data:
            return result

        serp_data = result_data[0]
        result["total_results_count"] = serp_data.get("se_results_count")

        items = serp_data.get("items", [])
        domain_clean = domain.lower().replace("www.", "")
        organic_items = []

        for item in items:
            item_type = item.get("type", "")

            # Track SERP features
            feature_map = {
                "featured_snippet": "featured_snippet_present",
                "local_pack": "local_pack_present",
                "knowledge_graph": "knowledge_panel_present",
                "people_also_ask": "people_also_ask_present",
                "video": "video_results_present",
                "images": "images_present",
                "shopping": "shopping_present",
                "ai_overview": "ai_overview_present",
            }
            for api_type, field in feature_map.items():
                if api_type in item_type:
                    result[field] = True

            if item_type != "organic":
                continue

            organic_items.append(item)
            item_domain = item.get("domain", "").lower().replace("www.", "")

            if item_domain == domain_clean and not result["is_found"]:
                result["is_found"] = True
                result["rank_absolute"] = item.get("rank_absolute")
                result["rank_group"] = item.get("rank_group")
                result["url"] = item.get("url", "")
                result["title"] = item.get("title", "")
                result["description"] = item.get("description", "")
                result["breadcrumb"] = item.get("breadcrumb", "")
                result["cache_url"] = item.get("cache_url", "")
                rank_abs = item.get("rank_absolute", 1)
                result["serp_page"] = ((rank_abs - 1) // 10) + 1

        # Top 5 competitors (organic results excluding client domain)
        for item in organic_items[:10]:
            item_domain = item.get("domain", "").lower().replace("www.", "")
            if item_domain != domain_clean:
                result["top_competitors"].append({
                    "rank": item.get("rank_absolute"),
                    "domain": item.get("domain", ""),
                    "url": item.get("url", ""),
                    "title": item.get("title", ""),
                })
                if len(result["top_competitors"]) >= 5:
                    break

        return result
