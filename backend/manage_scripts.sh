#!/bin/bash
# ============================================================
# SEO Tool — VPS Management Scripts
# Run from: /var/www/seo-tool/backend
# Always prefix with: source ../venv/bin/activate
# ============================================================

# USAGE: Copy-paste any block below into your VPS terminal.
# Or run: bash manage_scripts.sh <command>

SETTINGS="DJANGO_SETTINGS_MODULE=config.settings.production"
SHELL_CMD="$SETTINGS python manage.py shell -c"

case "$1" in

# ============================================================
# 1. DISCOVERY — Find keywords a domain ranks for
# ============================================================
discovery-all)
echo "Running discovery for ALL active clients..."
$SHELL_CMD "
from apps.discovery.tasks import monthly_keyword_discovery
result = monthly_keyword_discovery()
print(result)
"
;;

discovery-client)
echo "Running discovery for client ID $2..."
$SHELL_CMD "
from apps.clients.models import Client
from apps.discovery.tasks import _discover_keywords_for_client
c = Client.objects.get(id=$2)
result = _discover_keywords_for_client(c)
print(result)
"
;;

# ============================================================
# 2. RANK TRACKING — Check SERP positions for tracked keywords
# ============================================================
rank-all)
echo "Running rank tracking for ALL active clients..."
$SHELL_CMD "
from apps.rankings.tasks import weekly_rank_tracking
result = weekly_rank_tracking()
print(result)
"
;;

rank-client)
echo "Running rank tracking for client ID $2..."
$SHELL_CMD "
from django.conf import settings
from apps.clients.models import Client
from apps.keywords.models import Keyword, KeywordStatus
from apps.rankings.tasks import _check_keyword_rankings
from services.dataforseo import DataForSEOClient, SERPService, MapsService
from datetime import date

c = Client.objects.get(id=$2)
api = DataForSEOClient(login=settings.DATAFORSEO_LOGIN, password=settings.DATAFORSEO_PASSWORD)
serp = SERPService(api)
maps = MapsService(api)
today = date.today()

keywords = Keyword.objects.filter(client=c, status=KeywordStatus.TRACKED)
print(f'Checking {keywords.count()} keywords for {c.domain}...')

for kw in keywords:
    try:
        _check_keyword_rankings(kw, c, today, serp, maps)
        print(f'  OK: {kw.keyword_text} -> #{kw.current_organic_rank}')
    except Exception as e:
        print(f'  FAIL: {kw.keyword_text} -> {e}')

print('Done!')
"
;;

# ============================================================
# 3. CITATIONS — Check NAP accuracy on directories
# ============================================================
citations-check)
echo "Checking citations for client ID $2..."
$SHELL_CMD "
from apps.citations.tasks import check_citations_for_client
result = check_citations_for_client($2)
print(result)
"
;;

# ============================================================
# 4. BACKLINKS — Pull backlink profile
# ============================================================
backlinks-pull)
echo "Pulling backlinks for client ID $2..."
$SHELL_CMD "
from django.conf import settings
from datetime import date
from apps.clients.models import Client
from apps.backlinks.models import BacklinkSnapshot, Backlink, ReferringDomain, AnchorText
from services.dataforseo import DataForSEOClient, BacklinksService

c = Client.objects.get(id=$2)
api = DataForSEOClient(login=settings.DATAFORSEO_LOGIN, password=settings.DATAFORSEO_PASSWORD)
bl = BacklinksService(api)

print(f'Pulling backlinks for {c.domain}...')

# Summary
summary = bl.get_summary(c.domain)
snap = BacklinkSnapshot.objects.create(
    client=c, date=date.today(),
    total_backlinks=summary.get('total_backlinks', 0),
    referring_domains=summary.get('referring_domains', 0),
    referring_ips=summary.get('referring_ips', 0),
    broken_backlinks=summary.get('broken_backlinks', 0),
    broken_pages=summary.get('broken_pages', 0),
    dofollow=summary.get('dofollow', 0),
    nofollow=summary.get('nofollow', 0),
    rank=summary.get('rank'),
)
print(f'  Summary: {snap.total_backlinks} backlinks, {snap.referring_domains} domains, rank={snap.rank}')

# Individual backlinks
links = bl.get_backlinks(c.domain, limit=100)
for item in links.get('items', []):
    Backlink.objects.create(
        client=c, snapshot=snap,
        source_url=item.get('url_from', ''),
        source_domain=item.get('domain_from', ''),
        source_title=item.get('page_from_title', ''),
        target_url=item.get('url_to', ''),
        anchor=item.get('anchor', ''),
        is_dofollow=item.get('dofollow', True),
        source_rank=item.get('rank', None),
        first_seen=item.get('first_seen'),
        last_seen=item.get('last_seen'),
    )
print(f'  Saved {len(links.get(\"items\", []))} backlinks')

# Referring domains
domains = bl.get_referring_domains(c.domain, limit=100)
for item in domains.get('items', []):
    ReferringDomain.objects.create(
        client=c, snapshot=snap,
        domain=item.get('domain', ''),
        backlinks_count=item.get('backlinks', 0),
        dofollow_count=item.get('dofollow', 0),
        nofollow_count=item.get('nofollow', 0),
        rank=item.get('rank'),
        first_seen=item.get('first_seen'),
    )
print(f'  Saved {len(domains.get(\"items\", []))} referring domains')

# Anchors
anchors = bl.get_anchors(c.domain, limit=100)
for item in anchors.get('items', []):
    AnchorText.objects.create(
        client=c, snapshot=snap,
        anchor=item.get('anchor', ''),
        backlinks_count=item.get('backlinks', 0),
        referring_domains=item.get('referring_domains', 0),
        dofollow=item.get('dofollow', 0),
    )
print(f'  Saved {len(anchors.get(\"items\", []))} anchors')
print('Done!')
"
;;

# ============================================================
# 5. SITE AUDIT — Crawl a client's website
# ============================================================
audit-start)
echo "Starting site audit for client ID $2..."
$SHELL_CMD "
from django.conf import settings
from django.utils import timezone
from apps.clients.models import Client
from apps.onpage.models import SiteAudit
from services.dataforseo import DataForSEOClient, OnPageService

c = Client.objects.get(id=$2)
api = DataForSEOClient(login=settings.DATAFORSEO_LOGIN, password=settings.DATAFORSEO_PASSWORD)
op = OnPageService(api)

url = c.website_url or f'https://{c.domain}'
print(f'Starting crawl of {url}...')

task_id = op.start_crawl(url, max_pages=200)
audit = SiteAudit.objects.create(
    client=c, target_url=url, max_pages=200,
    status='crawling', started_at=timezone.now(),
    dataforseo_task_id=task_id,
)
print(f'Crawl started! Task ID: {task_id}')
print(f'Audit ID: {audit.id}')
print('Run \"audit-results <client_id> <audit_id>\" when crawl is complete (~2-5 min)')
"
;;

audit-results)
echo "Fetching audit results for client $2, audit $3..."
$SHELL_CMD "
from django.conf import settings
from django.utils import timezone
from apps.clients.models import Client
from apps.onpage.models import SiteAudit, AuditPage
from services.dataforseo import DataForSEOClient, OnPageService

audit = SiteAudit.objects.get(id=$3, client_id=$2)
api = DataForSEOClient(login=settings.DATAFORSEO_LOGIN, password=settings.DATAFORSEO_PASSWORD)
op = OnPageService(api)

print(f'Fetching results for task {audit.dataforseo_task_id}...')

# Summary
summary = op.get_crawl_summary(audit.dataforseo_task_id)
if summary:
    audit.pages_crawled = summary.get('pages_crawled', 0)
    audit.pages_with_errors = summary.get('pages_with_errors', 0)
    audit.pages_with_warnings = summary.get('pages_with_warnings', 0)
    audit.status = 'completed'
    audit.completed_at = timezone.now()
    audit.save()
    print(f'  Crawled {audit.pages_crawled} pages, {audit.pages_with_errors} errors')

# Pages
pages = op.get_pages(audit.dataforseo_task_id, limit=200)
for item in pages.get('items', []):
    AuditPage.objects.create(
        audit=audit, client_id=$2,
        url=item.get('url', ''),
        status_code=item.get('status_code'),
        title=item.get('meta', {}).get('title', ''),
        description=item.get('meta', {}).get('description', ''),
        h1=(item.get('meta', {}).get('htags', {}).get('h1', [''])[0] if item.get('meta', {}).get('htags', {}).get('h1') else ''),
        word_count=item.get('meta', {}).get('content', {}).get('plain_text_word_count'),
        page_load_time=item.get('page_timing', {}).get('duration'),
        internal_links_count=item.get('internal_links_count', 0),
        external_links_count=item.get('external_links_count', 0),
        broken_links_count=item.get('broken_links_count', 0),
        images_count=item.get('images_count', 0),
        images_missing_alt=item.get('images_without_alt_count', 0),
        is_indexable=item.get('is_indexable', True),
    )
print(f'  Saved {len(pages.get(\"items\", []))} page records')
print('Done!')
"
;;

# ============================================================
# 6. LIGHTHOUSE — Run PageSpeed test
# ============================================================
lighthouse)
echo "Running Lighthouse for client ID $2..."
$SHELL_CMD "
from django.conf import settings
from apps.clients.models import Client
from apps.onpage.models import LighthouseResult
from services.dataforseo import DataForSEOClient, OnPageService

c = Client.objects.get(id=$2)
api = DataForSEOClient(login=settings.DATAFORSEO_LOGIN, password=settings.DATAFORSEO_PASSWORD)
op = OnPageService(api)

url = c.website_url or f'https://{c.domain}'
print(f'Running Lighthouse for {url}...')

result = op.run_lighthouse(url, for_mobile=True)
if result:
    cats = result.get('categories', {})
    lr = LighthouseResult.objects.create(
        client=c, url=url, is_mobile=True,
        performance_score=int((cats.get('performance', {}).get('score') or 0) * 100),
        accessibility_score=int((cats.get('accessibility', {}).get('score') or 0) * 100),
        best_practices_score=int((cats.get('best-practices', {}).get('score') or 0) * 100),
        seo_score=int((cats.get('seo', {}).get('score') or 0) * 100),
    )
    print(f'  Performance: {lr.performance_score}')
    print(f'  Accessibility: {lr.accessibility_score}')
    print(f'  Best Practices: {lr.best_practices_score}')
    print(f'  SEO: {lr.seo_score}')
else:
    print('  No results returned')
print('Done!')
"
;;

# ============================================================
# 7. COMPETITOR DISCOVERY — Find competing domains
# ============================================================
competitors-discover)
echo "Discovering competitors for client ID $2..."
$SHELL_CMD "
from django.conf import settings
from apps.clients.models import Client
from apps.competitors.models import Competitor
from services.dataforseo import DataForSEOClient, LabsService

c = Client.objects.get(id=$2)
api = DataForSEOClient(login=settings.DATAFORSEO_LOGIN, password=settings.DATAFORSEO_PASSWORD)
labs = LabsService(api)

print(f'Finding competitors for {c.domain}...')
result = labs.get_competitors_domain(c.domain, location_code=c.location_code, limit=20)

for item in result.get('items', []):
    domain = item.get('domain', '')
    if domain and domain != c.domain:
        comp, created = Competitor.objects.get_or_create(
            client=c, domain=domain,
            defaults={'name': domain, 'is_auto_discovered': True}
        )
        status = 'NEW' if created else 'exists'
        print(f'  {status}: {domain} (shared kw: {item.get(\"avg_position\", \"?\")})')

print(f'Total competitors: {Competitor.objects.filter(client=c).count()}')
print('Done!')
"
;;

# ============================================================
# 8. FULL SYNC — Run everything for one client
# ============================================================
sync)
echo "Full sync for client ID $2..."
echo "Step 1/4: Discovery..."
$0 discovery-client $2
echo ""
echo "Step 2/4: Rank tracking..."
$0 rank-client $2
echo ""
echo "Step 3/4: Backlinks..."
$0 backlinks-pull $2
echo ""
echo "Step 4/4: Citations..."
$0 citations-check $2
echo ""
echo "Full sync complete!"
;;

# ============================================================
# 9. ENABLE TRACKING — Enable all tracking for all clients
# ============================================================
enable-all)
echo "Enabling all tracking for all clients..."
$SHELL_CMD "
from apps.clients.models import Client
from apps.keywords.models import Keyword

for c in Client.objects.all():
    c.track_organic = True
    c.track_maps = True
    c.is_active = True
    c.save()
    print(f'Enabled: {c.domain}')

count = Keyword.objects.all().update(maps_enabled=True)
print(f'Maps enabled for {count} keywords')
"
;;

# ============================================================
# 10. STATUS — Show all clients and their data counts
# ============================================================
status)
$SHELL_CMD "
from apps.clients.models import Client
from apps.keywords.models import Keyword
from apps.rankings.models import SERPResult
from apps.backlinks.models import BacklinkSnapshot
from apps.citations.models import Citation
from apps.onpage.models import SiteAudit

print(f'{'Client':<30} {'KWs':>5} {'Ranks':>6} {'BL':>5} {'Cit':>5} {'Audit':>5}')
print('-' * 65)
for c in Client.objects.all():
    kws = c.keywords.filter(status='tracked').count()
    ranks = SERPResult.objects.filter(client=c).count()
    bl = BacklinkSnapshot.objects.filter(client=c).count()
    cit = Citation.objects.filter(client=c).count()
    audits = SiteAudit.objects.filter(client=c).count()
    print(f'{c.domain:<30} {kws:>5} {ranks:>6} {bl:>5} {cit:>5} {audits:>5}')
"
;;

# ============================================================
# 11. SEED CITATIONS — Add default directories for a client
# ============================================================
seed-citations)
echo "Seeding citation directories for client ID $2..."
$SHELL_CMD "
from apps.clients.models import Client
from apps.citations.models import CitationDirectory, Citation

c = Client.objects.get(id=$2)

dirs = [
    ('Google Business Profile', 'https://business.google.com', 'major', True),
    ('Yelp', 'https://www.yelp.com', 'major', True),
    ('Facebook', 'https://www.facebook.com', 'major', True),
    ('BBB', 'https://www.bbb.org', 'major', True),
    ('Yellow Pages', 'https://www.yellowpages.com', 'major', True),
    ('Apple Maps', 'https://mapsconnect.apple.com', 'major', True),
    ('Bing Places', 'https://www.bingplaces.com', 'major', True),
    ('Foursquare', 'https://foursquare.com', 'major', True),
    ('Angi', 'https://www.angi.com', 'industry', False),
    ('HomeAdvisor', 'https://www.homeadvisor.com', 'industry', False),
    ('Thumbtack', 'https://www.thumbtack.com', 'industry', False),
    ('Nextdoor', 'https://nextdoor.com', 'general', False),
    ('MapQuest', 'https://www.mapquest.com', 'general', False),
    ('HotFrog', 'https://www.hotfrog.com', 'general', False),
    ('Merchant Circle', 'https://www.merchantcircle.com', 'general', False),
]

created = 0
for name, url, cat, key in dirs:
    d, _ = CitationDirectory.objects.get_or_create(name=name, defaults={'url': url, 'category': cat, 'is_key_citation': key})
    _, was_new = Citation.objects.get_or_create(client=c, directory=d, defaults={'status': 'not_found'})
    if was_new:
        created += 1

print(f'Created {created} citations for {c.domain}')
print(f'Total: {Citation.objects.filter(client=c).count()}')
"
;;

# ============================================================
# HELP
# ============================================================
*)
echo "SEO Tool Management Scripts"
echo ""
echo "Usage: bash manage_scripts.sh <command> [client_id] [extra_id]"
echo ""
echo "Commands:"
echo "  status                    Show all clients and data counts"
echo "  enable-all                Enable all tracking for all clients"
echo "  sync <client_id>          Full sync (discovery + ranks + backlinks + citations)"
echo "  discovery-all             Run discovery for all clients"
echo "  discovery-client <id>     Run discovery for one client"
echo "  rank-all                  Run rank tracking for all clients"
echo "  rank-client <id>          Run rank tracking for one client"
echo "  backlinks-pull <id>       Pull backlink profile for one client"
echo "  citations-check <id>      Check citation NAP for one client"
echo "  seed-citations <id>       Add default directories for one client"
echo "  competitors-discover <id> Find competitor domains"
echo "  audit-start <id>          Start site crawl"
echo "  audit-results <id> <aid>  Fetch crawl results (aid = audit ID)"
echo "  lighthouse <id>           Run Lighthouse PageSpeed test"
echo ""
echo "Examples:"
echo "  bash manage_scripts.sh status"
echo "  bash manage_scripts.sh sync 1"
echo "  bash manage_scripts.sh rank-client 3"
echo "  bash manage_scripts.sh backlinks-pull 1"
echo "  bash manage_scripts.sh audit-start 2"
;;

esac
