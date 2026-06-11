import logging

from django.conf import settings
from django.contrib import admin
from django.http import Http404, HttpResponse
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from django.views.generic.base import RedirectView
from django.views.static import serve

from splex.accounts.api.views import UpdateLastLoginTokenRefreshView
from splex.shared.api_views import MediaAttributionView, OpenSourceComponentsView, PrivateMediaView

logger = logging.getLogger(__name__)

INDEX_HTML = "index.html"


class PwaRouteView(TemplateView):
    route_name = "pwa"

    def get(self, request, *args, **kwargs):
        # Intentionally does not log the query string: invite/magic-login URLs
        # carry secret tokens there (e.g. ?token=...), which must never reach
        # the logs. The route name and path are enough for diagnostics.
        logger.info(
            "Serving PWA route route=%s path=%s",
            self.route_name,
            request.path,
        )
        return super().get(request, *args, **kwargs)


def serve_landing(request, path=""):
    """Serve the static marketing landing site from LANDING_ROOT.

    The landing is a multi-page static export (Astro emits directory-style pages,
    e.g. the German locale at de/index.html). For a request we try, in order:
    the literal path (real files like /_astro/..., /favicon.png, the
    Astro-generated /sitemap-index.xml), then path/index.html (a locale or
    directory page such as /de/), then the root index.html as the final
    fallback. `serve` sanitizes each path against directory traversal.
    """
    normalized = path.strip("/")
    candidates = []
    if normalized:
        candidates.append(normalized)
        candidates.append(f"{normalized}/{INDEX_HTML}")
    candidates.append(INDEX_HTML)
    for candidate in candidates:
        try:
            return serve(request, candidate, document_root=settings.LANDING_ROOT)
        except Http404:
            continue
    raise Http404


def robots_txt(request):
    """Keep the app (and its legal pages, which live under /app) out of search
    indexes while allowing the marketing landing to be crawled."""
    lines = [
        "User-agent: *",
        f"Disallow: {settings.APP_BASE_PATH}/",
    ]
    if settings.SERVE_LANDING:
        # Astro's @astrojs/sitemap emits sitemap-index.xml at the landing root.
        lines += ["", f"Sitemap: {settings.FRONTEND_PUBLIC_URL.rstrip('/')}/sitemap-index.xml"]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")


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
    index_view = PwaRouteView.as_view(template_name=INDEX_HTML, route_name="fallback")
    urlpatterns += [
        # Android App Links require assetlinks.json at the *domain root*,
        # regardless of where the app itself is served. Keep it before the /app
        # routes. The file lives at PWA_ROOT/.well-known/assetlinks.json.
        re_path(
            r"^\.well-known/assetlinks\.json$",
            serve,
            {"path": ".well-known/assetlinks.json", "document_root": settings.PWA_ROOT},
        ),
        # The app is served under /app. The exported assets physically live at
        # the PWA_ROOT root (Expo's baseUrl only rewrites the URLs), so strip the
        # /app prefix when mapping a request to a file.
        re_path(
            r"^app/(?P<path>(_expo/.*|assets/.*|icons/.*|favicon\.ico|manifest\.webmanifest|sw\.js))$",
            serve,
            {"document_root": settings.PWA_ROOT},
        ),
        # SPA fallback for every other /app route (deep links, client routing).
        re_path(r"^app(?:/.*)?$", index_view),
        path("robots.txt", robots_txt),
    ]
    if settings.SERVE_LANDING:
        # Marketing landing at the root, plus its own static assets.
        urlpatterns += [re_path(r"^(?P<path>.*)$", serve_landing)]
    else:
        # No landing page: send the root to the app so "/" still works.
        urlpatterns += [
            re_path(
                r"^$",
                RedirectView.as_view(url=f"{settings.APP_BASE_PATH}/", permanent=False),
            )
        ]
