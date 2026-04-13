from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import KeywordViewSet, PagesView

router = DefaultRouter()
router.register(r"keywords", KeywordViewSet, basename="keyword")

urlpatterns = [
    path("clients/<slug:client_slug>/", include(router.urls)),
    path("clients/<slug:client_slug>/pages/", PagesView.as_view(), name="pages"),
]
