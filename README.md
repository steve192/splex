# Splex

Self-hosted expense splitter with a Django backend and Expo/React TypeScript frontend.

## Development

The simple deployment target is one app container with SQLite in a mounted volume.

```sh
cp .env.example .env
docker compose up --build
```

The app listens on `http://localhost:8000`.

Magic login challenges expire after 15 minutes. Invitation links expire after 30 days
unless they are accepted or revoked earlier. The app container prunes expired or
already-used link records on startup. To run the cleanup manually, use:

```sh
docker compose exec app python manage.py cleanup_links
```

For local backend development without Docker:

```sh
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
python manage.py migrate
python manage.py runserver
```
