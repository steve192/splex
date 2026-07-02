FROM node:24.18.0-bookworm AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
COPY frontend/scripts ./scripts
COPY frontend/metro.config.js ./metro.config.js
RUN npm ci
COPY frontend ./
RUN npm run build:web

# Static marketing landing page (Astro). Built separately and served by Django
# at the site root; the app build above is served under /app.
FROM node:24.18.0-bookworm AS landing-build
WORKDIR /app/frontend-landing
COPY frontend-landing/package*.json ./
RUN npm ci
# sync-assets.mjs pulls the screenshots from docs/screenshots and the favicon
# from the app's maskable icon at build time, so both sources must be present in
# this stage's context (relative paths resolved from /app).
COPY docs /app/docs
COPY frontend/assets/images/pwa-maskable-icon.png /app/frontend/assets/images/pwa-maskable-icon.png
COPY frontend-landing ./
# Public site URL for canonical / Open Graph / sitemap URLs. Override at build
# time with `--build-arg LANDING_SITE_URL=https://splex.example.com`.
ARG LANDING_SITE_URL=https://splex.sterul.com
ENV LANDING_SITE_URL=${LANDING_SITE_URL}
# Never send Astro's anonymous build telemetry from CI / image builds.
ENV ASTRO_TELEMETRY_DISABLED=1
RUN npm run build

FROM python:3.14-slim AS backend
LABEL org.opencontainers.image.source=https://github.com/steve192/splex

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend/src
WORKDIR /app
COPY backend /app/backend
RUN pip install --no-cache-dir /app/backend
COPY --from=frontend-build /app/frontend/dist /app/backend/static_pwa
COPY --from=landing-build /app/frontend-landing/dist /app/backend/static_landing
COPY --from=frontend-build /app/frontend/src/shared/legal/openSourceComponents.generated.json /app/backend/src/splex/shared/openSourceComponents.generated.json
COPY frontend/src/shared/i18n/locales /app/backend/src/splex/shared/frontend_locales
WORKDIR /app/backend
RUN python manage.py collectstatic --noinput
RUN adduser --system --group --home /app splex \
    && mkdir -p /app/data /app/.gunicorn \
    && chown -R splex:splex /app/data /app/.gunicorn /app/backend/staticfiles /app/backend/static_pwa
EXPOSE 8000
CMD ["sh", "-c", "mkdir -p /app/data && chown -R splex:splex /app/data && exec su -s /bin/sh splex -c 'python -c \"from splex.shared.tos import ensure_terms_of_service_file; ensure_terms_of_service_file()\" && python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --worker-class gthread --workers ${GUNICORN_WORKERS:-2} --threads ${GUNICORN_THREADS:-4} --timeout ${GUNICORN_TIMEOUT:-60}'"]
