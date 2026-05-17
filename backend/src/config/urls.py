import logging

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from django.views.static import serve
from rest_framework_simplejwt.views import TokenRefreshView

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
    path("admin/", admin.site.urls),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
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
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.SERVE_PWA:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
        re_path(
            r"^(?P<path>(_expo/.*|assets/.*|favicon.ico|manifest.json|sw.js))$",
            serve,
            {"document_root": settings.PWA_ROOT},
        ),
        re_path(
            r"^invite/[^/]+/?$",
            PwaRouteView.as_view(template_name="invite/[token].html", route_name="invite"),
        ),
        re_path(
            r"^login/magic/?$",
            PwaRouteView.as_view(template_name="login/magic.html", route_name="login_magic"),
        ),
        re_path(
            r"^(?!api/|admin/).*$",
            PwaRouteView.as_view(template_name="index.html", route_name="fallback"),
        ),
    ]
