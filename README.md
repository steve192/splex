# Splex

Self-hosted opensource alternative to splitwise.

Split your expenses with friends and keep track who paid for what and who owes money to whom.
<p align="center">
   <img src="docs/screenshots/overview.png" alt="Splex Overview Screen" width="200"/>
   <img src="docs/screenshots/add-expense.png" alt="Splex Overview Screen" width="200"/>
   <img src="docs/screenshots/group.png" alt="Splex Overview Screen" width="200"/>
</p>

Available as Web App (PWA) that allows installation on mobile devices without downloading an app, but also as Android App.

[<img alt='Get it on Google Play' width=323 height=125 src='https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'/>](https://play.google.com/store/apps/details?id=com.sterul.splex)

## Try Splex

A public instance is available at **https://splex.sterul.com/**

You can try Splex without creating an account using the anonymous **demo mode**

## Motivation
Splitwise is a strong product for tracking shared expenses, whether you are traveling with friends or managing day-to-day costs in a shared household.

Over time, some features I considered essential became restricted behind a paywall, including limits around adding expenses.

I started looking for an open source alternative that matched my needs. I found [SplitPro](https://github.com/oss-apps/split-pro), but it did not fully cover the workflows I wanted, so I built Splex.


## Features

**Expense tracking**
- Track expenses in groups (any number of people) and 1-to-1 with friends
- Five split methods per expense: equal, equal among selected, exact amounts, percentages, and adjusted-equal
- Multiple payers per expense (e.g. you cover 70 €, your partner 30 €)
- Multi-currency expenses with automatic conversion at the time of entry
- Optional location for each expense, with a small map on the detail screen
- Suggestions for nearby expense descriptions based on your history
- Receipt attachments: upload images (JPEG/PNG/WebP) or PDFs per expense, up to a configurable size limit and per-group total quota
- Per-group balance, ledger and statistics views
- Settlements to clear debts, with manual and auto-write-off variants
- Activity feed of recent changes across all your groups and friendships

**Accounts and sharing**
- Passwordless login via emailed magic link / 6-digit code
- Optional Google login (web + native Android client)
- Invite friends and group members via shareable links with QR codes
- Configurable registration: open signup or closed-instance (existing users only)

**Privacy and data retention**
- Configurable automatic deletion of accounts inactive for X months
- Optional anonymous demo mode that runs entirely client-side without contacting the backend

**Notifications**
- Web push Web App and Expo push for the Android app
- Per-user push opt-in, multi-device 

**Apps and platforms**
- Installable Progressive Web App (offline-capable, with a sync queue for expenses entered while offline)
- Native Android app published on Google Play, plus APK builds on GitHub
- Light and dark themes

**Self-hosting**
- Single Docker image: app + PWA served from one container
- SQLite by default (zero external dependencies), optional PostgreSQL via `DATABASE_URL`
- Built-in background scheduler runs maintenance jobs automatically - no cron required
- All limits and timeouts (file sizes, retention windows, rate limits, token lifetimes) configurable via `.env`
- Customizable Terms of Service, Privacy Policy and Imprint pages

## Deployment

SQLite is the simplest choice for a small single-host install because it keeps everything in one mounted volume with no extra service to operate. PostgreSQL is the better choice when you want stronger concurrency, easier external backups, or a database service managed separately from the app container.

### URL layout

A single container serves three things under one domain:

- `/` — a static marketing landing page (set `SERVE_LANDING=false` to instead redirect `/` to the app).
- `/app` — the app itself (installable PWA). All app deep links live here, e.g. `/app/invite/<token>` and `/app/login/magic`.
- `/api` — the JSON API.

`FRONTEND_PUBLIC_URL` is the bare public origin (the landing root); the app is reached at `<origin>/app`. If you enable Google login, the **Authorized redirect URI** in the Google Cloud console must be `<origin>/app/login` (see `.env.example`). In the Android app's backend-URL field you can enter either `mydomain.com` or `mydomain.com/app` — both work.

### First-time setup

Create a directory for Splex on your server and place a `docker-compose.yml` there.

Decide if you want to use sqlite or postgres as your database.

#### sqlite database
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

#### postgres database

Use PostgreSQL when you want the app container and database in separate services.

```yaml
services:
   postgres:
      image: postgres:17
      environment:
         POSTGRES_DB: splex
         POSTGRES_USER: splex
         POSTGRES_PASSWORD: change-me
      volumes:
         - ./postgres-data:/var/lib/postgresql/data
      restart: unless-stopped

   splex:
      image: ghcr.io/steve192/splex:latest
      depends_on:
         - postgres
      env_file:
         - .env
      environment:
         DATABASE_URL: postgres://splex:change-me@postgres:5432/splex
      ports:
         - "8000:8000"
      volumes:
         - ./data:/app/data
      restart: unless-stopped
```


The `./data` mount is still needed with PostgreSQL because it holds uploaded
media files and the legal document files; only the database itself moves into `./postgres-data` .


Copy the environment template and fill it in:

```sh
curl -o .env https://raw.githubusercontent.com/steve192/splex/main/.env.example
# Edit .env - at minimum set SECRET_KEY, FRONTEND_PUBLIC_URL, BACKEND_PUBLIC_URL,
# and the email settings.
```

Pull the image and start:

```sh
docker compose pull
docker compose up -d
```

Database migrations are applied automatically on every container start.

### Updating

1. **Check for new settings** - compare your `.env` against the latest template.
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
   Migrations are applied automatically during startup - no manual `migrate` step needed.

### Backups

What you should back up depends on the database you use.

If you use SQLite, back up the `./data` directory. It contains the SQLite database,
uploaded media files, and the legal document files.

If you use PostgreSQL, back up both `./postgres-data` and `./data`. The PostgreSQL
volume contains the database itself, while `./data` still contains uploaded media
files and the legal document files.

For most self-hosted setups, regular filesystem snapshots or periodic backups of
those directories are sufficient.

### Admin console

> ⚠️ **Security warning** - the Django admin UI provides full read/write access to
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
console email backend - it writes every email to stdout so the login code and link
show up directly in the container logs:

1. Open your `.env` file.
2. Replace the `EMAIL_BACKEND` line (and optionally remove the `EMAIL_HOST` /
   `EMAIL_PORT` / `EMAIL_USE_TLS` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD`
   lines - they are ignored by the console backend):
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


### FAQ


<details>
<summary>Will you properly maintain this app?</summary>

Yes.

My friends and I use this app every day. If something breaks, it affects our daily workflow directly.

</details>


<details>

<summary>Will this app stay free?</summary>

Yes.

If you self-host Splex, it will remain free to use.

Running a public instance is different, because public hosting can create real
operating costs.

Right now, most of those services are covered by free tiers or open source
friendly plans, but that may change if usage grows significantly.

The main cost factors for a public instance are server hosting itself
(CPU, memory, storage, and bandwidth), email delivery, backups, and any
monitoring or logging infrastructure needed to keep the service reliable.

Push notifications are not a direct cost today in the current setup: web push is
self-hosted with VAPID keys, and Expo's push notification service is documented
as free at the moment. That said, provider limits or pricing can always change.

Google login is also not a direct billed feature in the current setup. Splex uses
Google OAuth client IDs and token verification, not Google Identity Platform's
paid sign-in tiers. Still, external platform rules and quotas can change over time.

If the public instance ever becomes expensive to operate at scale, I may add ads
or another way to offset those hosting costs for the public service.

That would only apply to the public instance, never to self-hosted deployments.


</details>

<details>

<summary>Is there an iPhone app?</summary>

Not at the moment.

The current architecture could theoretically support an iPhone app, but I do not
own an iPhone and do not have an Apple Developer license.

If you use an iPhone, you can still install the PWA and get nearly the same
experience as with a native app.

Native iPhone support may happen in the future, but it is not on the near-term roadmap.

</details>

<details>

<summary>What should I back up?</summary>

If you use SQLite, back up `./data`.

If you use PostgreSQL, back up both `./postgres-data` and `./data`.

`./data` is always important because it stores uploaded media files and the legal
document files, even when PostgreSQL is used for the database.

</details>

<details>

<summary>Was AI used to develop this app? (AI Transparency)</summary>
<a id="ai-transparency"></a>

Yes.

In open source, this gets asked often. Fair question, but not the deciding one.

The better questions to ask, are is the software dependable, secure, and
careful with user data? Does it behave as documented? Is there clear ownership
when something goes wrong?

Those standards do not change based on tooling. Purely Human-written code and
AI-assisted code can both contain bugs, poor abstractions, and bad decisions.
What matters is whether the person shipping it understands the system,
evaluates tradeoffs responsibly, and can explain why things are built the way
they are.

How I use AI in my workflow:

- Research: exploring unfamiliar libraries, APIs, and implementation patterns.
- Discussion and iteration: testing ideas, architecture, edge cases,
  and failure modes before or during implementation.
- Implementation: sometimes rough drafts, sometimes repetitive boilerplate,
  sometimes pair-programming-style back-and-forth on concrete code.

Quality varies a lot. Some generated code is discarded quickly, some parts are
kept with small edits. Either way, nothing is "trusted by default". I review,
test, and maintain what ships.

AI helps with speed, not accountability. Responsibility for Splex stays with me.

</details>

## Roadmap

- Import from Splitwise
- Import from other split tools such as SplitPro

## Contributing

If you are missing a feature, open an issue.

That gives us a place to discuss whether the feature is a good fit for Splex,
how it should be implemented, and whether someone is available to do the work.