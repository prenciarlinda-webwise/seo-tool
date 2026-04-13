import logging

from .client import DataForSEOClient

logger = logging.getLogger(__name__)


class MapsService:
    """Google Maps SERP rank checking via DataForSEO."""

    ENDPOINT = "serp/google/maps/live/advanced"

    def __init__(self, client: DataForSEOClient):
        self.client = client

    def check_maps(
        self,
        keyword: str,
        location_code: int = 2840,
        language_code: str = "en",
        depth: int = 20,
    ) -> dict:
        """Run a live Maps SERP check for a single keyword."""
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
    def find_business_position(
        task_result: dict,
        domain: str = "",
        place_id: str = "",
        business_name: str = "",
    ) -> dict:
        """Extract Maps pack position for a business.

        Matches by domain, place_id, or business_name (in that priority order).
        """
        result = {
            "is_found": False,
            "rank_group": None,
            "rank_absolute": None,
            "title": "",
            "domain": "",
            "url": "",
            "phone": "",
            "address": "",
            "latitude": None,
            "longitude": None,
            "place_id": "",
            "cid": "",
            "feature_id": "",
            "rating_value": None,
            "rating_count": None,
            "category": "",
            "work_hours": None,
            "is_claimed": None,
            "check_url": "",
            "top_competitors": [],
        }

        result_data = task_result.get("result", [])
        if not result_data:
            return result

        serp_data = result_data[0]
        result["check_url"] = serp_data.get("check_url", "")
        items = serp_data.get("items", [])
        domain_clean = domain.lower().replace("www.", "") if domain else ""
        business_name_lower = business_name.lower() if business_name else ""

        matched = False
        for item in items or []:
            item_domain = (item.get("domain") or "").lower().replace("www.", "")
            item_place_id = item.get("place_id") or ""
            item_title = (item.get("title") or "").lower()

            is_match = False
            if place_id and item_place_id == place_id:
                is_match = True
            elif domain_clean and item_domain == domain_clean:
                is_match = True
            elif business_name_lower and business_name_lower in item_title:
                is_match = True

            if is_match and not matched:
                matched = True
                result["is_found"] = True
                result["rank_group"] = item.get("rank_group")
                result["rank_absolute"] = item.get("rank_absolute")
                result["title"] = item.get("title") or ""
                result["domain"] = item.get("domain") or ""
                result["url"] = item.get("url") or ""
                result["phone"] = item.get("phone") or ""
                result["address"] = item.get("address") or ""
                result["place_id"] = item.get("place_id") or ""
                result["cid"] = item.get("cid") or ""
                result["feature_id"] = item.get("feature_id") or ""
                result["category"] = item.get("category") or ""
                result["work_hours"] = item.get("work_hours")
                result["is_claimed"] = item.get("is_claimed")

                gps = item.get("gps_coordinates") or {}
                result["latitude"] = gps.get("latitude")
                result["longitude"] = gps.get("longitude")

                rating = item.get("rating") or {}
                result["rating_value"] = rating.get("value")
                result["rating_count"] = rating.get("votes_count")
            elif not is_match:
                result["top_competitors"].append({
                    "rank": item.get("rank_absolute"),
                    "domain": item.get("domain", ""),
                    "title": item.get("title", ""),
                    "rating": (item.get("rating") or {}).get("value"),
                    "reviews": (item.get("rating") or {}).get("votes_count"),
                })
                if len(result["top_competitors"]) >= 5:
                    if matched:
                        break

        return result
