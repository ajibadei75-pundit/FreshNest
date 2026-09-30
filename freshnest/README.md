# FreshNest Cleaning Services

The FreshNest website, its booking backend and an admin page for the owner, in one small program.
It has **no runtime dependencies**: you need [Node.js](https://nodejs.org) 18 or newer (22 recommended), nothing else.

## How everything connects

```
Customer (phone or laptop)                Server                                Owner
  Website  ── POST /api/bookings ───────▶ checks, re-prices, saves ─── alerts ─▶ phone / Telegram / email
  (public/) ◀─ GET  /api/public  ──────── data/db.json + daily backups
                                              ▲
                                              │ /api/admin/*  (password, HTTP-only cookie)
                                          Admin page (public/admin): bookings, reviews,
                                          projects, hours, pause booking, backups
```

- **Settings flow one way.** Change the phone number, hours or announcement in the admin page and the website, the "Open now" badge and the search-engine data all update immediately.
- **Prices are checked twice.** `public/js/pricing.js` is used by the browser to show the estimate and by the server to re-price every booking, so a tampered price is ignored.
- **Consent is enforced twice.** The tick box unlocks after the terms are read; the server also refuses any booking without consent, and stores when, which terms version, and a hashed IP.
- **Reviews are gated.** Customer feedback stays private until the owner publishes it, and only if the customer allowed that.
- **You hear about every booking.** Alerts go to your phone, Telegram and/or email. A failing alert never blocks a customer's booking.

```
server/            backend: API, sign-in, storage, alerts, backups, static files
public/            the website; public/admin is the owner's admin page
data/              created on first run: bookings, feedback, projects, photos, backups (keep private)
deploy/            Caddyfile (automatic HTTPS) and a systemd unit for a plain server
scripts/           doctor.js (pre-flight check), healthcheck.js, build-preview.js
test/              41 automated tests
Dockerfile, docker-compose.yml, render.yaml, .env.example
```

## Try it on your computer

```
node server/index.js
```

Website: http://localhost:3000 and admin: http://localhost:3000/admin/. On the first run the server prints a random admin password. **Save it then**; it is not shown again.

## Going live

**Decide two things first.** (1) Where the server runs. (2) Where the data lives: it must be a **persistent disk**, because bookings are stored in `DATA_DIR`. On many hosts the normal folder is erased on every deploy, which would delete your bookings. The server warns you at start-up if this looks wrong.

### Configuration

Copy `.env.example` to `.env` and fill it in (or set the same names as environment variables on your host).

| Variable | What it does |
| --- | --- |
| `NODE_ENV=production` | Turns on the production warnings. |
| `PUBLIC_URL` | Your address with https, e.g. `https://www.example.ng`. Used for search engines, `robots.txt`, `sitemap.xml` and links in alerts. |
| `ADMIN_PASSWORD` | At least 10 characters. When set it always wins, and it lets you restore access on a new server. |
| `DATA_DIR` | Folder on the persistent disk. |
| `TRUST_PROXY` | How many proxies are in front of the app (`1` for Render, Railway, Caddy, nginx; `2` if Cloudflare is in front of Render). The server reads the visitor's real IP from the right end of `X-Forwarded-For`, which visitors cannot fake. Detected automatically on Render, Railway, Fly, Koyeb and Heroku. Without it, all visitors would share one booking limit. |
| `COOKIE_SECURE=1` | Always mark the sign-in cookie Secure. |
| `PORT` | Default 3000. Hosts usually set it for you. |

**Alerts (turn on at least one, then use "Send a test alert" in the admin page):**

| Channel | Set | How |
| --- | --- | --- |
| Phone notification | `NOTIFY_URL` | Install the free ntfy app, subscribe to a long random topic, then `NOTIFY_URL=https://ntfy.sh/your-long-random-topic`. |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Make a bot with @BotFather, send it a message, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your chat id. |
| Email | `RESEND_API_KEY`, `NOTIFY_EMAIL` (comma-separated), `MAIL_FROM` | Free account at resend.com. Until you verify your own domain there, Resend only delivers to your own account email and `MAIL_FROM` must stay `FreshNest <onboarding@resend.dev>`. |

### Check before you launch

```
npm run doctor            # checks your settings and says what is ready and what is not
npm run doctor -- --live  # also asks the running site to prove it is up and locked down
```

### Option A: Render

1. Put this folder in a GitHub repository.
2. In Render: **New > Blueprint**, pick the repository. `render.yaml` sets the start command, the health check, a 1 GB persistent disk at `/data`, and the settings above.
3. Fill in `PUBLIC_URL` and `ADMIN_PASSWORD` (and an alert channel) when Render asks.
4. Add your own domain under Settings > Custom Domains if you have one, and update `PUBLIC_URL`.

A persistent disk needs a paid instance type; the free tier would lose your data on every restart.

### Option B: Railway, Fly.io or any Docker host

Deploy the `Dockerfile` (no build step, no dependencies). Attach a **volume mounted at `/data`** and set `PUBLIC_URL`, `ADMIN_PASSWORD` and an alert channel. `DATA_DIR=/data` and `TRUST_PROXY=1` are already set in the image. The image runs as an unprivileged user and has a health check.

### Option C: Your own server with automatic HTTPS

On any Linux server with Docker, with your domain's DNS already pointing at it:

```
cp .env.example .env      # fill it in, and add a line:  DOMAIN=www.example.ng
docker compose up -d
```

Caddy gets and renews a free HTTPS certificate on its own. Without Docker, run `node server/index.js` under systemd using `deploy/freshnest.service` and put Caddy or nginx in front.

### After launch

- Sign in at `/admin/`, open **Settings**, and check your phone number, email, opening hours and the alert test.
- Place a test booking from your phone and confirm the alert arrives.
- Add real projects under **Our work** when you have photos you may show.
- Have a lawyer review the terms text (see below).

## Backups

The server copies `db.json` into `DATA_DIR/backups` at start-up and every 6 hours, keeping the newest 14 days. That protects against mistakes, not against losing the disk, so also click **Download a backup** in the admin page now and then and keep the file somewhere else. (The download leaves out the password hash and signing secret.) Photos live in `DATA_DIR/uploads` and are not in the download; copy that folder too.

To restore: stop the server, put the backup at `DATA_DIR/db.json`, start it, and sign in with `ADMIN_PASSWORD`.

The data contains customers' names, phone numbers and addresses. Keep every copy private.

## Changing things

| To change | Where |
| --- | --- |
| Phone, email, opening hours, announcement, pause online booking | Admin, Settings. Updates the website immediately. |
| Real projects and before/after photos | Admin, Our work. |
| Approve customer reviews | Admin, Reviews. |
| Prices, room rates, time slots, booking window | `public/js/pricing.js` |
| Booking terms and privacy text | `public/index.html`, inside `id="terms"`. Change `termsVersion` in `public/js/pricing.js` whenever you edit it, because each booking stores the version the customer accepted. |
| Cleaning tips | `TIPS` in `public/js/site.js` |
| Colours, fonts, button sizes | Variables at the top of `public/css/base.css`, shared by the site and the admin page. |

**The terms text is a plain-language draft, not legal advice.** Have a lawyer review it, especially the cancellation, damage and data sections.

## Tests

```
npm install     # once, for the browser-simulation tests
npm test
```

41 tests: the API and security rules, alerts (against a stand-in server), backups and restore, proxy IP handling, compression, and the real pages driven in jsdom (booking flow, consent lock, admin). The UI tests need Node 22.22+ and skip themselves if jsdom is not installed. GitHub Actions runs them on every push (`.github/workflows/ci.yml`).

## One-file preview

`npm run build:preview` writes `dist/freshnest-preview.html`: the public site as one file with no backend, for showing the design. Bookings fall back to email and WhatsApp there.

## Good to know

- Storage is one JSON file with atomic writes: comfortable for a single small business. If you outgrow it, `server/store.js` is the only file to replace.
- Run **one** copy of the server. Rate limits are kept in memory.
- On shutdown (a redeploy, for example) the server finishes in-flight requests and any pending save before it exits.
- Security in place: password hashed with scrypt, HTTP-only same-site cookie, sign-in rate limit, cross-site request check, strict content-security policy, HSTS over HTTPS, upload type checks, CSV formula protection.
