from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import KeywordViewSet, PagesView

router = DefaultRouter()
router.register(r"keywords", KeywordViewSet, basename="keyword")

urlpatterns = [
    path("clients/<int:client_pk>/", include(router.urls)),
    path("clients/<int:client_pk>/pages/", PagesView.as_view(), name="pages"),
]
