from django.urls import path

from .views import AuditPageListView, LighthouseListView, SiteAuditDetailView, SiteAuditListView

urlpatterns = [
    path("clients/<int:client_pk>/audits/", SiteAuditListView.as_view(), name="site-audit-list"),
    path("clients/<int:client_pk>/audits/<int:audit_pk>/", SiteAuditDetailView.as_view(), name="site-audit-detail"),
    path("clients/<int:client_pk>/audits/<int:audit_pk>/pages/", AuditPageListView.as_view(), name="audit-page-list"),
    path("clients/<int:client_pk>/lighthouse/", LighthouseListView.as_view(), name="lighthouse-list"),
]
