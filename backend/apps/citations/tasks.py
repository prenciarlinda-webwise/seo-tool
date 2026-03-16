import logging
import re
from datetime import date

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task
def check_citations_for_client(client_id):
    """
    For each citation directory linked to a client, use DataForSEO to:
    1. Search the directory for the business
    2. Check if NAP matches
    """
    from apps.citations.models import Citation
    from apps.clients.models import Client
    from services.dataforseo import DataForSEOClient, BusinessDataService, OnPageService

    client = Client.objects.get(id=client_id)
    api_client = DataForSEOClient(
        login=settings.DATAFORSEO_LOGIN,
        password=settings.DATAFORSEO_PASSWORD,
    )
    onpage = OnPageService(api_client)
    business = BusinessDataService(api_client)

    # Client's canonical NAP
    canonical_name = (client.google_business_name or client.name).lower().strip()
    canonical_phone = _normalize_phone(client.contact_phone)
    canonical_address = client.address.lower().strip()
    canonical_zip = client.zip_code.strip()

    citations = Citation.objects.filter(client=client).select_related("directory")
    checked = 0

    for citation in citations:
        directory = citation.directory
        if not directory.url:
            continue

        try:
            result = _check_single_citation(
                onpage=onpage,
                business_service=business,
                client=client,
                citation=citation,
                canonical_name=canonical_name,
                canonical_phone=canonical_phone,
                canonical_address=canonical_address,
                canonical_zip=canonical_zip,
            )

            citation.status = result["status"]
            citation.listed_name = result.get("listed_name", "")
            citation.listed_phone = result.get("listed_phone", "")
            citation.listed_address = result.get("listed_address", "")
            citation.listed_zip = result.get("listed_zip", "")
            citation.name_accurate = result.get("name_accurate")
            citation.address_accurate = result.get("address_accurate")
            citation.phone_accurate = result.get("phone_accurate")
            citation.zip_accurate = result.get("zip_accurate")
            citation.last_checked_at = date.today()
            citation.save()
            checked += 1

        except Exception:
            logger.exception(
                "Failed to check citation %s for client %s",
                directory.name, client.domain,
            )

    logger.info("Checked %d citations for %s", checked, client.domain)
    return {"checked": checked, "client": client.domain}


def _check_single_citation(
    onpage, business_service, client, citation,
    canonical_name, canonical_phone, canonical_address, canonical_zip,
):
    """Check a single citation using DataForSEO instant page scrape."""
    directory = citation.directory

    # Strategy: Use Google search to find the business on the directory
    # Search query: "business name" site:directory-domain
    dir_domain = _extract_domain(directory.url)
    search_query = f'"{client.google_business_name or client.name}" site:{dir_domain}'

    # Use the business data API for Google-specific lookups
    if "google" in dir_domain.lower():
        try:
            info = business_service.get_business_info(
                keyword=client.google_business_name or client.name,
                location_code=client.location_code,
            )
            if info:
                return _match_business_info(
                    info, canonical_name, canonical_phone, canonical_address, canonical_zip
                )
        except Exception:
            logger.warning(
                "Google business lookup failed for %s on %s",
                client.domain, dir_domain, exc_info=True,
            )

    # For other directories, scrape the page if we have a listing URL
    if citation.listing_url:
        try:
            page_data = onpage.get_instant_page(citation.listing_url)
            return _match_page_content(
                page_data, canonical_name, canonical_phone, canonical_address, canonical_zip
            )
        except Exception:
            logger.warning(
                "Page scrape failed for citation %s (%s)",
                citation.listing_url, client.domain, exc_info=True,
            )

    # No listing URL — try to detect via the directory search
    return {"status": "not_found"}


def _match_business_info(info, canonical_name, canonical_phone, canonical_address, canonical_zip):
    """Match Google Business data against canonical NAP."""
    listed_name = (info.get("title") or "").strip()
    listed_phone = _normalize_phone(info.get("phone") or "")
    listed_address = (info.get("address") or "").lower().strip()
    listed_zip = info.get("zip") or ""

    return {
        "status": "found",
        "listed_name": listed_name,
        "listed_phone": info.get("phone", ""),
        "listed_address": info.get("address", ""),
        "listed_zip": listed_zip,
        "name_accurate": listed_name.lower() == canonical_name,
        "phone_accurate": listed_phone == canonical_phone,
        "address_accurate": _fuzzy_address_match(listed_address, canonical_address),
        "zip_accurate": listed_zip.strip() == canonical_zip,
    }


def _match_page_content(page_data, canonical_name, canonical_phone, canonical_address, canonical_zip):
    """Check if page content contains matching NAP data."""
    content = (page_data.get("content") or "").lower() if page_data else ""
    title = (page_data.get("title") or "").lower() if page_data else ""
    full_text = f"{title} {content}"

    if not full_text.strip():
        return {"status": "not_found"}

    name_found = canonical_name in full_text
    phone_found = canonical_phone in _normalize_phone(full_text) if canonical_phone else None
    address_found = _fuzzy_address_match(full_text, canonical_address) if canonical_address else None

    if name_found or phone_found:
        return {
            "status": "found",
            "listed_name": canonical_name if name_found else "",
            "listed_phone": canonical_phone if phone_found else "",
            "listed_address": "",
            "listed_zip": "",
            "name_accurate": name_found,
            "phone_accurate": phone_found,
            "address_accurate": address_found,
            "zip_accurate": canonical_zip in full_text if canonical_zip else None,
        }

    return {"status": "not_found"}


def _normalize_phone(phone):
    """Strip everything except digits."""
    return re.sub(r"[^\d]", "", phone or "")


def _extract_domain(url):
    """Extract domain from URL."""
    from urllib.parse import urlparse
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return url


def _fuzzy_address_match(a, b):
    """Simple fuzzy address match — check if key parts overlap."""
    if not a or not b:
        return None
    a_parts = set(re.split(r"[,\s]+", a.lower().strip()))
    b_parts = set(re.split(r"[,\s]+", b.lower().strip()))
    # If >60% of parts match, consider it a match
    if not b_parts:
        return None
    overlap = len(a_parts & b_parts) / len(b_parts)
    return overlap > 0.6
