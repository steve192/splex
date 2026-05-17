FROM node:20-bookworm AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build:web

FROM python:3.11-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend/src
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY backend /app/backend
RUN pip install --no-cache-dir /app/backend
COPY --from=frontend-build /app/frontend/dist /app/backend/static_pwa
WORKDIR /app/backend
RUN python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["sh", "-c", "mkdir -p /app/data && python manage.py migrate --noinput && python manage.py cleanup_links && gunicorn config.wsgi:application --bind 0.0.0.0:8000"]
