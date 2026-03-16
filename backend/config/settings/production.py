from .base import *  # noqa: F401, F403

DEBUG = False

# Set via DJANGO_ALLOWED_HOSTS env var
# ALLOWED_HOSTS is already read from env in base.py

# Postgres is configured via DATABASE_URL in base.py
# Redis/Celery is configured via CELERY_BROKER_URL in base.py

# Security
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"
