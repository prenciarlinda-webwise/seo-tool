import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("seo_tool")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# Override beat schedule with proper crontab objects
app.conf.beat_schedule = {
    "weekly-rank-tracking": {
        "task": "apps.rankings.tasks.weekly_rank_tracking",
        "schedule": crontab(minute=0, hour=3, day_of_week=1),
    },
    "monthly-keyword-discovery": {
        "task": "apps.discovery.tasks.monthly_keyword_discovery",
        "schedule": crontab(minute=0, hour=4, day_of_month=1),
    },
}
