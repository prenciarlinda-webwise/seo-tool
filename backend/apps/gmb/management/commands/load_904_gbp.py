"""Load GBP data for 904 Dumpster from manually collected Google Business Profile insights."""
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.clients.models import Client
from apps.gmb.models import GBPCallMetric, GBPPerformanceMetric, GBPSearchKeyword


def _distribute(total, days):
    """Distribute a total evenly across N days, assigning remainders to first days."""
    base = total // days
    remainder = total % days
    return [base + (1 if i < remainder else 0) for i in range(days)]


# ── Monthly data ────────────────────────────────────────────────

MONTHS = [
    {
        "year": 2025, "month": 11, "days": 30,
        "impressions": {"total": 451, "search_mobile": 275, "search_desktop": 116, "maps_desktop": 37, "maps_mobile": 23},
        "searches": 120,
        "interactions": [1,1,4,2,1,2,6,0,1,3,5,4,0,3,1,3,2,1,5,1,2,0,2,0,2,4,0,1,0,1],
        "calls":        [0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,0,0,1,1,0,0,0,0,0,0,2,0,0,0,1],
        "chats":        [0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        "bookings":     [0]*30,
        "keywords": [
            ("dumpster rental jacksonville fl", 83),
            ("dumpster rental", 19),
            ("dumpster", 18),
        ],
    },
    {
        "year": 2025, "month": 12, "days": 31,
        "impressions": {"total": 527, "search_mobile": 297, "search_desktop": 166, "maps_desktop": 51, "maps_mobile": 13},
        "searches": 152,
        "interactions": [0,4,1,1,2,0,0,3,2,1,3,0,1,1,3,4,2,1,2,2,3,8,0,0,3,1,2,1,5,4,0],
        "calls":        [0,1,0,0,0,0,0,1,0,0,2,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
        "chats":        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
        "bookings":     [0]*31,
        "website":      [0,3,1,1,2,0,0,2,2,1,1,0,1,1,2,3,2,1,2,1,1,8,0,0,3,1,2,1,5,4,0],
        "keywords": [
            ("dumpster rental jacksonville fl", 135),
            ("dumpster rental", 17),
        ],
    },
    {
        "year": 2026, "month": 1, "days": 31,
        "impressions": {"total": 578, "search_mobile": 338, "search_desktop": 179, "maps_desktop": 46, "maps_mobile": 15},
        "searches": 175,
        "interactions": [4,3,2,1,8,0,2,2,1,1,2,4,7,7,3,2,0,0,6,0,6,2,3,1,6,3,1,4,0,7,0],
        "calls":        [0,0,1,0,1,0,0,0,0,0,0,0,2,3,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,3,0],
        "chats":        [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
        "bookings":     [0]*31,
        "website":      [4,3,1,1,7,0,2,2,1,1,2,4,4,4,3,2,0,0,3,0,6,2,3,1,6,3,1,4,0,4,0],
        "keywords": [
            ("dumpster rental jacksonville fl", 131),
            ("dumpster", 26),
            ("dumpster rental", 18),
        ],
    },
    {
        "year": 2026, "month": 2, "days": 28,
        "impressions": {"total": 477, "search_mobile": 281, "search_desktop": 139, "maps_desktop": 47, "maps_mobile": 10},
        "searches": 103,
        "interactions": [0,2,5,0,0,8,4,0,3,7,1,2,4,7,2,5,6,3,3,0,4,0,6,1,5,0,2,3],
        "calls":        [0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,0,1,0,0,0],
        "chats":        [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        "bookings":     [0]*28,
        "website":      [0,2,5,0,0,7,4,0,3,6,1,2,2,7,2,4,6,2,3,0,4,0,6,1,4,0,2,3],
        "keywords": [
            ("dumpster rental jacksonville fl", 103),
        ],
    },
    {
        "year": 2026, "month": 3, "days": 31,
        "impressions": {"total": 545, "search_mobile": 316, "search_desktop": 167, "maps_desktop": 36, "maps_mobile": 26},
        "searches": 155,
        "interactions": [5,6,3,2,4,2,1,4,9,5,6,4,6,3,1,1,3,0,8,3,2,1,2,0,6,3,6,2,0,3,0],
        "calls":        [0,3,1,0,1,0,0,0,4,1,0,0,1,0,0,0,1,0,3,2,2,0,0,0,3,0,3,1,0,1,0],
        "chats":        [0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
        "bookings":     [0]*31,
        # website = interactions - calls - chats - bookings (no explicit daily data)
        "keywords": [
            ("dumpster rental jacksonville fl", 139),
            ("dumpster rental", 16),
        ],
    },
    {
        "year": 2026, "month": 4, "days": 12,  # partial month (through Apr 12)
        "impressions": {"total": 208, "search_mobile": 69, "search_desktop": 48, "maps_desktop": 84, "maps_mobile": 7},
        "searches": 0,  # still being collected
        "interactions": [6,4,3,3,2,3,2,4,0,0,0,0],
        "calls":        [2,1,1,1,0,1,0,1,0,0,0,0],  # 7 total distributed
        "chats":        [0,0,0,0,0,0,0,1,0,0,0,0],  # 1 total
        "bookings":     [0]*12,
        "website":      [4,3,2,2,2,2,2,2,0,0,0,0],  # 19 total
        "keywords": [],  # still being collected
    },
]


class Command(BaseCommand):
    help = "Load GBP performance data for 904 Dumpster (Nov 2025 - Feb 2026)"

    def handle(self, *args, **options):
        client = Client.objects.get(slug="904-dumpster")
        perf_created = 0
        call_created = 0
        kw_created = 0

        for m in MONTHS:
            year, month, num_days = m["year"], m["month"], m["days"]
            imp = m["impressions"]

            # Distribute monthly impressions across days proportionally to interactions
            total_int = sum(m["interactions"]) or 1
            daily_imp_total = []
            for i, intx in enumerate(m["interactions"]):
                frac = intx / total_int
                daily_imp_total.append(round(imp["total"] * frac))

            # Adjust rounding so totals match
            diff = imp["total"] - sum(daily_imp_total)
            for i in range(abs(diff)):
                daily_imp_total[i % num_days] += 1 if diff > 0 else -1

            # Platform ratios
            t = imp["total"] or 1
            r_sm = imp["search_mobile"] / t
            r_sd = imp["search_desktop"] / t
            r_md = imp["maps_desktop"] / t
            r_mm = imp["maps_mobile"] / t

            for day_idx in range(num_days):
                d = date(year, month, day_idx + 1)
                interactions = m["interactions"][day_idx]
                calls = m["calls"][day_idx]
                chats = m["chats"][day_idx]
                bookings = m["bookings"][day_idx]

                # Website clicks: use explicit data if available, otherwise derive
                if "website" in m:
                    website = m["website"][day_idx]
                else:
                    website = interactions - calls - chats - bookings

                day_imp = daily_imp_total[day_idx]

                perf, created = GBPPerformanceMetric.objects.update_or_create(
                    client=client, date=d,
                    defaults={
                        "business_impressions_mobile_search": round(day_imp * r_sm),
                        "business_impressions_desktop_search": round(day_imp * r_sd),
                        "business_impressions_desktop_maps": round(day_imp * r_md),
                        "business_impressions_mobile_maps": round(day_imp * r_mm),
                        "total_impressions": day_imp,
                        "call_clicks": calls,
                        "website_clicks": website,
                        "direction_requests": 0,
                        "business_conversations": chats,
                        "business_bookings": bookings,
                        "total_interactions": interactions,
                    },
                )
                if created:
                    perf_created += 1

                # Call metrics (daily)
                if calls > 0:
                    _, created = GBPCallMetric.objects.update_or_create(
                        client=client, date=d,
                        defaults={
                            "total_calls": calls,
                            "answered_calls": calls,
                            "missed_calls": 0,
                        },
                    )
                    if created:
                        call_created += 1

            # Search keywords for the month
            period_start = date(year, month, 1)
            period_end = date(year, month, num_days)

            for kw_text, kw_impressions in m["keywords"]:
                _, created = GBPSearchKeyword.objects.update_or_create(
                    client=client,
                    period_start=period_start,
                    keyword=kw_text,
                    defaults={
                        "period_end": period_end,
                        "impressions": kw_impressions,
                    },
                )
                if created:
                    kw_created += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done: {perf_created} performance records, "
            f"{call_created} call records, "
            f"{kw_created} search keywords created for 904 Dumpster"
        ))
