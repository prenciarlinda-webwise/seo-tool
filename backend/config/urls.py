from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.clients.urls")),
    path("api/", include("apps.keywords.urls")),
    path("api/", include("apps.rankings.urls")),
    path("api/", include("apps.discovery.urls")),
    path("api/", include("apps.gmb.urls")),
    path("api/", include("apps.analytics.urls")),
    path("api/", include("apps.plans.urls")),
    path("api/", include("apps.onpage.urls")),
    path("api/", include("apps.backlinks.urls")),
    path("api/", include("apps.competitors.urls")),
    path("api/", include("apps.citations.urls")),
]
