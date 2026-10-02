# FreshNest Cleaning Services

The FreshNest website, its booking backend and an admin page for the owner, in one small program.
It has **no runtime dependencies**. It runs in two ways from the same code:

- **On Vercel** (website served from its network, bookings stored in an Upstash Redis database): follow **[docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)**.
- **On any normal Node host** (your own server, Docker, Render, Railway; bookings stored in a file): see "Going live" below. You need [Node.js](https://nodejs.org) 22.

**What it offers:** seven services (Residential, Office & Commercial, Deep, Hostel, Move-in & Move-out, One-time & Regular, Post-Construction) in six cities (Ibadan, Oyo, Ogbomoso, Osogbo, Ilorin, Lagos). Customers get an instant price, send a booking request in about two minutes, and you manage everything from the admin page.

## The website, page by page

| Page | Address | What it is for |
| --- | --- | --- |
| Home | `/` | What we do, the seven services, how it works, the six cities, one clear "Get a price" button. |
| Services | `/services` | Each service with its checklist and extras, a jump bar, and a "Get a price for this" button. |
| Book | `/book` | The five-step estimate and booking form. Price and Continue button stay on screen. |
| Locations | `/locations` | The six cities, each linking to a booking in that city. |
| Our work | `/work` | Real projects you add in admin (with before/after photos), plus cleaning tips. |
| Reviews | `/reviews` | Approved customer reviews and the feedback form. |
| FAQ | `/faq` | Searchable answers, grouped by topic. |
| Contact | `/contact` | Call, WhatsApp, email, opening hours with today highlighted, and an open/closed badge. |
| Terms | `/terms` | The booking terms and privacy notice (the same text the booking form asks customers to read). |

Shortcuts: `/book?service=hostel&city=Ilorin` opens the form with those chosen and skips to the rooms step. The Services and Locations pages and the footer use these links.

## Logo and brand

The logo is the file in `assets/source/FreshNest_Logo.jpg`. A JPG has a white box behind it, so the site uses transparent pieces cut from it, in `site/img/`. They are WebP, which keeps all the logo pictures a first-time visitor downloads under 30 KB (a PNG version would be about 110 KB, which matters on mobile data). Full-quality PNG masters are kept in `assets/logo/`, and `logo-full.png` / `logo-full-light.png` are ready to download for social media profiles or print.

| File | Used for |
| --- | --- |
| `logo-mark-128.webp`, `logo-mark.png` | The round emblem in the header, footer and admin page (WebP, tiny), and as a PNG for search-engine data. |
| `logo-disc.webp`, `logo-droplet.webp`, `logo-sparkle.webp` | The emblem split into three layers that line up exactly. They move separately in the welcome animation on the home page. |
| `logo-word.webp`, `logo-tag.webp` and the `-light` versions | The "FreshNest" wordmark and the tagline. The dark version shows on light pages, the light version on night mode and on dark panels such as the footer. |
| `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png` | The browser tab icon and the icon when someone adds the site, or the admin page, to their phone's home screen (`site.webmanifest`, `admin/admin.webmanifest`). |
| `og-image.png` | The picture shown when a link to the site is shared on WhatsApp or Facebook. It needs `PUBLIC_URL` to be set. |

**The welcome animation** (home page): the disc pops in, the droplet falls into place, the wordmark wipes in, the tagline rises, the sparkle pops and keeps gently twinkling, and a glint sweeps across the emblem now and then. Click the logo to play it again. It stops completely for visitors who ask their device to reduce motion, and then they simply see the finished logo.

**The site's colours follow the logo:** emerald-to-deep-teal for brand and buttons, the wordmark's deep green for the footer and dark panels, and the sparkle's gold for the main buttons. They are variables at the top of `site/css/base.css`, and a test checks that the contrast stays accessible.

**Changing the logo later:** replace `assets/source/FreshNest_Logo.jpg` with the new file (a white background works best) and run `python3 scripts/make-logo-assets.py` (needs `pip install pillow numpy scipy`; the website itself never needs Python). It rebuilds every picture above. If the new logo has a different shape, the welcome animation layers and the sizes in `partials/` may need adjusting.

## How everything connects

```
Customer (phone or laptop)                Server                                Owner
  Website  ── POST /api/bookings ───────▶ checks, re-prices, saves ─── alerts ─▶ phone / Telegram / email
  (site/)   ◀─ GET  /api/public  ──────── storage: a file (server) or Upstash Redis (Vercel)
                                              ▲
                                              │ /api/admin/*  (password, HTTP-only cookie)
                                          Admin page (site/admin): overview, bookings, reviews,
                                          projects, settings, help
```

- **Settings flow one way.** Change the phone number, hours or announcement in the admin page and every page, the "Open now" badge and the search-engine data update immediately.
- **Prices are checked twice.** `site/js/pricing.js` is used by the browser to show the estimate and by the server to re-price every booking, so a tampered price is ignored. The same file holds the services, cities, time slots and one-tap room layouts, so the form, the server and the tests always agree.
- **Cities are enforced.** The booking form only offers the six cities and the server refuses anything else.
- **Consent is enforced twice.** The tick box unlocks after the terms are read; the server also refuses any booking without consent, and stores when, which terms version, and a hashed IP.
- **Reviews are gated.** Customer feedback stays private until you publish it, and only if the customer allowed that.
- **You hear about every booking.** Alerts go to your phone, Telegram and/or email. A failing alert never blocks a customer's booking.

```
api/[...path].js   Vercel entry: the whole /api/* backend as one function
server/index.js    normal-host entry: starts a Node server (also serves the website, keeps daily file backups)
lib/               the backend, shared by both entries
  app.js             wires everything together: createApp({ mode: 'server' | 'vercel' })
  routes/            public.js (bookings, feedback, site data, photos) and admin.js (everything the owner does)
  storage/           file.js (JSON file) and redis.js (Upstash), one interface, tested identical
  limiter.js  session.js  auth.js  validate.js  notify.js  config.js  http.js  pages.js  site.js  backup.js
site/              the website source: pages (*.html), css/, js/, img/ (logo pieces), admin/ (the owner's admin page)
partials/          shared head, header, footer and icons (edit the menu once, here)
scripts/           build-site.js, doctor.js, import-data.js, reset-password.js, healthcheck.js, make-logo-assets.py
test/              automated tests (and helpers/mock-upstash.js, a stand-in for the database)
docs/              DEPLOY-VERCEL.md, step by step for Vercel
assets/            the original logo and PNG masters (not published)
vercel.json  Dockerfile  docker-compose.yml  render.yaml  .env.example  deploy/
```

## Try it on your computer

```
node server/index.js
```

Website: http://localhost:3000 and admin: http://localhost:3000/admin/. On the first run the server prints a random admin password. **Save it then**; it is not shown again.

## The admin page

Sign in at `/admin/`. It has six tabs: **Overview** (what needs attention, pause online booking), **Bookings** (search, filter, call or WhatsApp the customer, set status, final price and private notes, export to a spreadsheet), **Reviews** (publish or hide), **Our work** (add projects and photos), **Settings** (details, hours, alerts, backups, password) and **Help**.

**Help** is written for the owner, not a developer. It has a setup checklist that ticks itself off, an **Access details** card (the admin address, how sign-in works, how long you stay signed in, what happens after wrong passwords, how to recover a lost password), a daily routine, and step-by-step guides for the things that come up: a new booking, a cancellation, being fully booked, a review, adding a job, changing hours, keeping data safe, and missing alerts.

**Access in plain terms:** there is one shared password. Anyone with it can see customers' names, phone numbers and addresses, so share it only with people you trust. You stay signed in for up to 12 hours on a device, and after 8 wrong tries from one connection sign-in locks for 15 minutes.

**Lost the password?** Stop the server, run the command below, and start it again. It prints a new password and signs everyone else out. (If `ADMIN_PASSWORD` is set on your host, change that setting instead.)

```
npm run reset-password
npm run reset-password -- "a password phrase you choose"
```

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
npm run doctor            # checks your settings and that every page builds
npm run doctor -- --live  # also asks the running site to prove it is up and locked down
```

### Option A: Vercel

Full walk-through in **[docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)**. In short: push the project to GitHub, import it in Vercel, add an **Upstash Redis** database from the Storage tab, set `ADMIN_PASSWORD` (and `PUBLIC_URL` and an alert channel) under Environment Variables, deploy, then run `npm run doctor -- --vercel --live`. **Note:** Vercel's free Hobby plan is for non-commercial use only, so a business site needs its Pro plan.

### Option B: Render

1. Put this folder in a GitHub repository.
2. In Render: **New > Blueprint**, pick the repository. `render.yaml` sets the start command, the health check, a 1 GB persistent disk at `/data`, and the settings above.
3. Fill in `PUBLIC_URL` and `ADMIN_PASSWORD` (and an alert channel) when Render asks.
4. Add your own domain under Settings > Custom Domains if you have one, and update `PUBLIC_URL`.

A persistent disk needs a paid instance type; the free tier would lose your data on every restart.

### Option C: Railway, Fly.io or any Docker host

Deploy the `Dockerfile` (no build step, no dependencies). Attach a **volume mounted at `/data`** and set `PUBLIC_URL`, `ADMIN_PASSWORD` and an alert channel. `DATA_DIR=/data` and `TRUST_PROXY=1` are already set in the image. The image runs as an unprivileged user and has a health check.

### Option D: Your own server with automatic HTTPS

On any Linux server with Docker, with your domain's DNS already pointing at it:

```
cp .env.example .env      # fill it in, and add a line:  DOMAIN=www.example.ng
docker compose up -d
```

Caddy gets and renews a free HTTPS certificate on its own. Without Docker, run `node server/index.js` under systemd using `deploy/freshnest.service` and put Caddy or nginx in front.

### After launch

- Sign in at `/admin/` and work down the **Help** tab's setup checklist.
- Place a test booking from your phone and confirm the alert arrives.
- Add real projects under **Our work** when you have photos you may show.
- Have a lawyer review the terms text (see below).

## Backups

**On Vercel** there are no daily file copies: your data is in Upstash Redis, which keeps its own copy. Click **Download a backup** in the admin page now and then; it includes the photos. Restore (or move to another host) with `npm run import-data -- backup.json`. The paragraphs below describe the normal-server setup.

The server copies `db.json` into `DATA_DIR/backups` at start-up and every 6 hours, keeping the newest 14 days. That protects against mistakes, not against losing the disk, so also click **Download a backup** in the admin page now and then and keep the file somewhere else. (The download leaves out the password hash and signing secret.) Photos live in `DATA_DIR/uploads` and are not in the download; copy that folder too.

To restore: stop the server, put the backup at `DATA_DIR/db.json`, start it, and sign in with `ADMIN_PASSWORD`.

The data contains customers' names, phone numbers and addresses. Keep every copy private.

## Changing things

| To change | Where |
| --- | --- |
| Phone, email, opening hours, announcement, pause online booking | Admin, Settings. Updates the website immediately. |
| Real projects and before/after photos | Admin, Our work. |
| Approve customer reviews | Admin, Reviews. |
| Prices, room rates, one-tap room layouts, time slots, booking window, the list of cities | `site/js/pricing.js` (read the comments at the top of each block). |
| Service descriptions and checklists | `site/services.html` (and the cards in `site/index.html`). |
| The menu and footer | `partials/header.html` and `partials/footer.html`: one edit updates every page. |
| Booking terms and privacy text | `site/js/terms.js`. Change `termsVersion` in `site/js/pricing.js` whenever you edit it, because each booking stores the version the customer accepted. |
| FAQ answers | `site/faq.html` |
| Cleaning tips | `TIPS` in `site/js/work.js` |
| Colours, fonts, button sizes | Variables at the top of `site/css/base.css`, shared by the site and the admin page. |

**The prices for Hostel Cleaning are a starting point** (student rooms, shared bathrooms, toilets, kitchens, common rooms and corridors, with a 35,000 minimum). Check them against what you actually charge. **The terms text is a plain-language draft, not legal advice.** Have a lawyer review it, especially the cancellation, damage and data sections.

## Motion and accessibility

Pages fade in, content rises into view once as you scroll, cards respond to hover, the mobile menu slides in, and moving between pages cross-fades in browsers that support it. Everything stops for visitors who ask their device to reduce motion, and content never stays hidden if a script fails. Menus, dialogs, tabs and forms work with a keyboard, buttons are at least 44px tall, and colour contrast meets WCAG AA.

## Tests

```
npm install     # once, for the browser-simulation tests (jsdom)
npm test
```

The tests cover the API and security rules, the same storage checks run against both the file and the Redis backends (using a stand-in for Upstash), the real Vercel function end to end (shared limits, alerts sent before replying, photos in the database, backups, 20 simultaneous bookings), `vercel.json`, the build output, data import, (including attempts to slip scripts in through names, reviews and project titles), the logo files and how every page uses them, all seven services and six cities, alerts (against a stand-in server), backups and restore, the first-run password and reset command, proxy IP handling, compression, every page, and the real pages driven in jsdom (the booking flow and consent lock, the FAQ search, the admin page and its Help tab). The browser-simulation tests need Node 22.22+ and skip themselves if jsdom is not installed. GitHub Actions runs them on every push.

## One-folder preview

`npm run build:preview` writes `preview/`: the whole website as plain files with no backend. Open `index.html` by double-clicking, or upload the folder to any static host to show the design. Bookings fall back to email and WhatsApp there, and there are no reviews or projects.

## Good to know

- Storage is behind one interface (`lib/storage/`): a JSON file with atomic writes on a normal host, Upstash Redis on Vercel. Both are comfortable for a single small business; to use something else (Postgres, say), add one file beside `file.js` and `redis.js`.
- On a normal host run **one** copy of the server (rate limits are kept in memory). On Vercel any number of copies is fine: limits and sessions live in the database.
- On shutdown (a redeploy, for example) the server finishes in-flight requests and any pending save before it exits.
- Security in place: password hashed with scrypt, HTTP-only same-site cookie, sign-in rate limit, cross-site request check, strict content-security policy, HSTS over HTTPS, upload type checks, CSV formula protection.
