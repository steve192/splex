import logging

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from django.views.static import serve

from splex.accounts.api.views import UpdateLastLoginTokenRefreshView
from splex.shared.api_views import MediaAttributionView, OpenSourceComponentsView, PrivateMediaView

logger = logging.getLogger(__name__)


class PwaRouteView(TemplateView):
    route_name = "pwa"

    def get(self, request, *args, **kwargs):
        logger.info(
            "Serving PWA route route=%s path=%s query=%s",
            self.route_name,
            request.path,
            request.META.get("QUERY_STRING", ""),
        )
        return super().get(request, *args, **kwargs)


urlpatterns = [
    path(
        "api/auth/token/refresh/",
        UpdateLastLoginTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    # `<token>/attribution/` is registered before the catch-all so the
    # `<path:token>` route below doesn't greedily swallow it.
    path(
        "api/media/<path:token>/attribution/",
        MediaAttributionView.as_view(),
        name="media_attribution",
    ),
    path("api/media/<path:token>/", PrivateMediaView.as_view(), name="private_media"),
    path(
        "api/open-source-components/",
        OpenSourceComponentsView.as_view(),
        name="open_source_components",
    ),
    path("api/", include("splex.accounts.api.urls")),
    path("api/", include("splex.groups.api.urls")),
    path("api/", include("splex.friends.api.urls")),
    path("api/", include("splex.expenses.api.urls")),
    path("api/", include("splex.settlements.api.urls")),
    path("api/", include("splex.invitations.api.urls")),
    path("api/", include("splex.activity.api.urls")),
    path("api/", include("splex.currency.api.urls")),
    path("api/", include("splex.sync.api.urls")),
    path("api/", include("splex.notifications.api.urls")),
    path("api/", include("splex.imports.api.urls")),
]

if settings.ENABLE_ADMIN_UI:
    urlpatterns = [path("admin/", admin.site.urls), *urlpatterns]

if settings.SERVE_PWA:
    urlpatterns += [
        re_path(
            r"^(?P<path>(_expo/.*|assets/.*|icons/.*|favicon\.ico|manifest\.webmanifest|sw\.js|\.well-known/assetlinks\.json))$",
            serve,
            {"document_root": settings.PWA_ROOT},
        ),
        re_path(
            r"^(?!api/|admin/).*$",
            PwaRouteView.as_view(template_name="index.html", route_name="fallback"),
        ),
    ]
