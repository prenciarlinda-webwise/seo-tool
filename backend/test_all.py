"""
Smoke tests for all SEO Tool models and tasks.

Run with:
    python manage.py test test_all --settings=config.settings.test
    # or
    DJANGO_SETTINGS_MODULE=config.settings.production python manage.py shell < test_all.py
"""
import sys
from datetime import date


def test_clients():
    from apps.clients.models import Client

    print("--- test_clients ---")
    count = Client.objects.count()
    print(f"  Total clients: {count}")
    for c in Client.objects.all()[:5]:
        print(f"  {c.domain} | active={c.is_active} | organic={c.track_organic} | maps={c.track_maps}")
    assert count >= 0, "Client query failed"
    print("  PASS")


def test_keywords():
    from apps.keywords.models import Keyword, KeywordStatus

    print("--- test_keywords ---")
    total = Keyword.objects.count()
    tracked = Keyword.objects.filter(status=KeywordStatus.TRACKED).count()
    discovered = Keyword.objects.filter(status=KeywordStatus.DISCOVERED).count()
    print(f"  Total: {total} | Tracked: {tracked} | Discovered: {discovered}")
    for kw in Keyword.objects.filter(status=KeywordStatus.TRACKED)[:5]:
        print(f"  {kw.keyword_text} | rank={kw.current_organic_rank} | maps={kw.current_maps_rank}")
    assert total >= 0, "Keyword query failed"
    print("  PASS")


def test_rankings():
    from apps.rankings.models import SERPResult, MapsRankResult

    print("--- test_rankings ---")
    serp_count = SERPResult.objects.count()
    maps_count = MapsRankResult.objects.count()
    print(f"  SERP results: {serp_count} | Maps results: {maps_count}")
    for r in SERPResult.objects.select_related("keyword", "client")[:5]:
        print(f"  {r.keyword.keyword_text} | #{r.rank_absolute} | {r.checked_at}")
    assert serp_count >= 0, "SERP query failed"
    assert maps_count >= 0, "Maps query failed"
    print("  PASS")


def test_discovery():
    from apps.discovery.models import DiscoveryRun, DiscoveryResult

    print("--- test_discovery ---")
    runs = DiscoveryRun.objects.count()
    results = DiscoveryResult.objects.count()
    print(f"  Runs: {runs} | Results: {results}")
    for run in DiscoveryRun.objects.all()[:3]:
        print(f"  {run.client.domain} | {run.run_date} | status={run.status} | kws={run.total_keywords_found}")
    assert runs >= 0, "Discovery query failed"
    print("  PASS")


def test_citations():
    from apps.citations.models import Citation, CitationDirectory

    print("--- test_citations ---")
    dirs = CitationDirectory.objects.count()
    cits = Citation.objects.count()
    print(f"  Directories: {dirs} | Citations: {cits}")
    for c in Citation.objects.select_related("client", "directory")[:5]:
        print(f"  {c.client.domain} on {c.directory.name} | status={c.status} | errors={c.nap_errors}")
    assert dirs >= 0, "Citation directory query failed"
    print("  PASS")


def test_backlinks():
    from apps.backlinks.models import BacklinkSnapshot, Backlink, ReferringDomain, AnchorText

    print("--- test_backlinks ---")
    snaps = BacklinkSnapshot.objects.count()
    links = Backlink.objects.count()
    domains = ReferringDomain.objects.count()
    anchors = AnchorText.objects.count()
    print(f"  Snapshots: {snaps} | Links: {links} | Domains: {domains} | Anchors: {anchors}")
    for s in BacklinkSnapshot.objects.select_related("client")[:3]:
        print(f"  {s.client.domain} | {s.date} | backlinks={s.total_backlinks} | rank={s.rank}")
    assert snaps >= 0, "Backlink query failed"
    print("  PASS")


def test_onpage():
    from apps.onpage.models import SiteAudit

    print("--- test_onpage ---")
    audits = SiteAudit.objects.count()
    print(f"  Audits: {audits}")
    for a in SiteAudit.objects.select_related("client")[:3]:
        print(f"  {a.client.domain} | {a.status} | pages={a.pages_crawled}")
    assert audits >= 0, "Audit query failed"
    print("  PASS")


def test_competitors():
    from apps.competitors.models import Competitor

    print("--- test_competitors ---")
    count = Competitor.objects.count()
    print(f"  Competitors: {count}")
    for comp in Competitor.objects.select_related("client")[:5]:
        print(f"  {comp.client.domain} vs {comp.domain}")
    assert count >= 0, "Competitor query failed"
    print("  PASS")


def test_dataforseo_service():
    from services.dataforseo import DataForSEOClient, SERPService, MapsService, LabsService

    print("--- test_dataforseo_service ---")

    # Test that find_domain_position handles empty input
    result = SERPService.find_domain_position({}, "example.com")
    assert result["is_found"] is False, "Should not find domain in empty result"
    assert result["rank_absolute"] is None, "Rank should be None for empty result"

    # Test that find_domain_position handles None result list
    result = SERPService.find_domain_position({"result": []}, "example.com")
    assert result["is_found"] is False, "Should not find domain in empty result list"

    # Test that find_business_position handles empty input
    result = MapsService.find_business_position({}, domain="example.com")
    assert result["is_found"] is False, "Should not find business in empty result"

    # Test that parse_ranked_keywords handles empty input
    keywords = LabsService.parse_ranked_keywords({})
    assert keywords == [], "Should return empty list for empty input"

    # Test that parse_ranked_keywords handles None-like result
    keywords = LabsService.parse_ranked_keywords({"result": []})
    assert keywords == [], "Should return empty list for empty result"

    print("  All service edge-case tests passed")
    print("  PASS")


def run_all():
    tests = [
        test_clients,
        test_keywords,
        test_rankings,
        test_discovery,
        test_citations,
        test_backlinks,
        test_onpage,
        test_competitors,
        test_dataforseo_service,
    ]

    passed = 0
    failed = 0
    errors = []

    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as e:
            failed += 1
            errors.append((test_fn.__name__, str(e)))
            print(f"  FAIL: {e}")

    print()
    print("=" * 50)
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    if errors:
        print()
        print("Failures:")
        for name, err in errors:
            print(f"  {name}: {err}")
    print("=" * 50)

    return failed == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
else:
    # Running via manage.py shell
    run_all()
