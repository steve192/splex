# Splex

Self-hosted expense opensource alternative to splitwise.

Split your expenses with friends and keep track who paid for what and who owes money to whom.


## Deployment

### First-time setup

Create a directory for Splex on your server and place a `docker-compose.yml` there:

```yaml
services:
  app:
    image: ghcr.io/steve192/splex:latest
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

The `./data` directory is created automatically by Docker on first start and holds
the SQLite database and uploaded media files. Back this directory up regularly.

Copy the environment template and fill it in:

```sh
curl -o .env https://raw.githubusercontent.com/steve192/splex/main/.env.example
# Edit .env — at minimum set SECRET_KEY, FRONTEND_PUBLIC_URL, BACKEND_PUBLIC_URL,
# and the email settings.
```

Pull the image and start:

```sh
docker compose pull
docker compose up -d
```

Database migrations are applied automatically on every container start.

### Updating

1. **Check for new settings** — compare your `.env` against the latest template.
   New variables are occasionally added; the app will log errors or behave
   incorrectly if a required one is missing.
   ```sh
   curl -s https://raw.githubusercontent.com/steve192/splex/main/.env.example | diff - .env
   ```
   Add any missing variables and set sensible values before restarting.

2. **Pull the new image and restart:**
   ```sh
   docker compose pull
   docker compose up -d
   ```
   Migrations are applied automatically during startup — no manual `migrate` step needed.

### Admin console

> ⚠️ **Security warning** — the Django admin UI provides full read/write access to
> all data in the database. Never expose `/admin/` to the public internet without
> additional protection such as a firewall rule, VPN, or a reverse-proxy IP allowlist.
> A compromised admin account is a full database compromise.

To enable the admin UI:

1. Add `ENABLE_ADMIN_UI=true` to your `.env` and restart the container:
   ```sh
   docker compose up -d
   ```

2. Create a superuser account (run once):
   ```sh
   docker compose exec app python manage.py createsuperuser
   ```
   Follow the prompts to set an email address and password.

3. Open `http://your-server:8000/admin/` in your browser and sign in with those credentials.

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

### Email in development

By default the app needs a working SMTP server to deliver magic login links and
codes.  For local development you can skip that entirely by switching to Django's
console email backend — it writes every email to stdout so the login code and link
show up directly in the container logs:

1. Open your `.env` file.
2. Replace the `EMAIL_BACKEND` line (and optionally remove the `EMAIL_HOST` /
   `EMAIL_PORT` / `EMAIL_USE_TLS` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD`
   lines — they are ignored by the console backend):
   ```env
   EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
   ```
3. Restart the container and request a magic login.  The email content, including
   the 6-digit code and the clickable link, will appear in:
   ```sh
   docker compose logs -f app
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
