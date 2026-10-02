# Deploying FreshNest on Vercel

This is a step-by-step guide. You do not need to be a developer. Allow about 30 minutes.

> **Read this first: which Vercel plan?** Vercel's free **Hobby** plan is for personal, non-commercial use only. A business site that advertises services and takes booking requests counts as commercial, so it needs Vercel's paid **Pro** plan (listed at about $20 a month when this was written; check [vercel.com/pricing](https://vercel.com/pricing)). Everything else here can start on free tiers. If you prefer a free or cheaper host, FreshNest also runs on a normal server: see the main README (Render, Docker, or your own server).

## What you will have at the end

- The website, served worldwide from Vercel's network, so pages load fast.
- The booking and admin system running as one small Vercel function.
- Your bookings, reviews, projects and photos stored in an **Upstash Redis** database that you create from inside Vercel.
- Alerts to your phone, Telegram or email when a booking arrives.

## How it differs from a normal server

| | Normal server (Docker, Render, VPS) | Vercel |
| --- | --- | --- |
| Where bookings are kept | A file on the server's disk | Upstash Redis database |
| Project photos | A folder on the disk | The same database (served and cached by the CDN) |
| Website pages | Built on each visit | Built once at deploy time, served as plain files |
| Admin password | Generated on first start, or `ADMIN_PASSWORD` | `ADMIN_PASSWORD` is required (there is no private console to print one to) |
| Daily backup copies | Made by the server | Not made by FreshNest. Upstash keeps its own copy; you can also download a backup from the admin page whenever you like |
| Changing opening hours or phone | Search engines see it immediately | Visitors see it immediately; search engines see it after the next deploy (or automatically, with a Deploy Hook, below) |

## Before you start

You need three free accounts: **GitHub** (to hold the code), **Vercel** (to run it), and, created from inside Vercel, **Upstash**. For alerts, pick one of ntfy.sh, Telegram or Resend (the README explains each).

## Step 1. Put the project on GitHub

Unzip `freshnest.zip`. In the folder, in a terminal:

```
git init
git add .
git commit -m "FreshNest"
```

Create an empty repository on github.com (private is fine), then follow the two lines GitHub shows to push your code (`git remote add origin ...` and `git push -u origin main`). The file `.gitignore` already keeps secrets and data out.

## Step 2. Import it into Vercel

1. In Vercel choose **Add New, Project** and pick your GitHub repository.
2. Vercel reads `vercel.json` and fills in the build for you (build command `npm run build`, output folder `dist`). **Leave everything as it is.**
3. Do not press Deploy yet. First add the database and the settings (steps 3 and 4). A first deploy without them is harmless, it just shows a clear message instead of working.

## Step 3. Add the database (Upstash Redis)

1. Open the project, go to **Storage**, and choose to add a database from the **Marketplace**. Pick **Upstash Redis** (Vercel's own KV was retired, and Upstash is what replaced it).
2. Create it and **connect it to this project**. Vercel then adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project's Environment Variables by itself. You do not copy anything.
3. Put the database and the Vercel function in the **same region**. In Project, Settings, Functions, choose the function region; the nearest options to Nigeria are a European region (for example London or Paris) or Cape Town. Pick the closest one that Upstash also offers.

About the free Upstash plan: it is small (at the time of writing roughly 500,000 commands a month and 256 MB), and Upstash archives free databases that are not used for a long stretch (at least 30 days; it keeps a backup you can restore). A business that receives bookings will not hit that, but you can also upgrade to pay-as-you-go. FreshNest is built to be gentle: the dashboard loads with about eight commands, and the public site's data is cached by Vercel for 30 seconds.

## Step 4. Add your settings (Environment Variables)

Project, **Settings, Environment Variables**. Add these for Production (and Preview if you want previews to work):

| Name | What to put | Required? |
| --- | --- | --- |
| `ADMIN_PASSWORD` | A long password or phrase, at least 10 characters. This is how you sign in at `/admin/`. | **Yes** |
| `PUBLIC_URL` | Your website address with https, for example `https://www.example.ng`. Used for search engines, link previews and links inside alerts. Add it once your domain works (step 6). | Recommended |
| `NOTIFY_URL` | Phone alerts through ntfy.sh, for example `https://ntfy.sh/your-long-random-topic`. | One alert channel is strongly recommended |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram alerts. | optional |
| `RESEND_API_KEY`, `NOTIFY_EMAIL`, `MAIL_FROM` | Email alerts through Resend. | optional |
| `DEPLOY_HOOK_URL` | A Deploy Hook address (Project, Settings, Git, Deploy Hooks, create one). When you save Settings in the admin page, FreshNest calls it so the site rebuilds and search engines pick up new opening hours or phone number. | optional |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Added automatically by step 3. | automatic |

Never share `ADMIN_PASSWORD`, or the alert tokens. Anyone with the password can see customers' names, phone numbers and addresses.

## Step 5. Deploy

Press **Deploy** (or push any change to GitHub: every push deploys automatically). When it finishes, open the address Vercel shows. You should see the website. Open `/admin/`, sign in with `ADMIN_PASSWORD`, and open the **Help** tab: it has a checklist that ticks itself off.

## Step 6. Your own domain

Project, **Settings, Domains**, add your domain and follow Vercel's instructions at your domain registrar. When it shows as valid, set `PUBLIC_URL` to the new address (step 4) and redeploy (Deployments, the three dots, Redeploy).

## Step 7. Check everything

On your computer, in the project folder:

```
vercel env pull .env          # downloads your settings (needs the Vercel CLI: npm i -g vercel, then: vercel link)
npm run doctor -- --vercel --live
```

`doctor` says in plain words what is ready and what is missing, and with `--live` it asks your real site to prove it is up and that the admin data is locked.

Then do the human check: send yourself a test booking from your phone, confirm the alert arrives, and see the booking appear in the admin page.

## Moving a site you already run on a server

If you already have FreshNest on a normal server with real bookings, bring them across without retyping anything. On the server, in the project folder, download nothing; just run this on your own computer after `vercel env pull .env`:

```
npm run import-data -- path/to/data/db.json --photos path/to/data/uploads
```

(Or use a backup downloaded from the admin page: `npm run import-data -- freshnest-backup-2026-10-02.json`.) It copies bookings, reviews, projects, settings and photos, rewrites the photo addresses for Vercel, and never copies passwords. If the new database already holds data it stops and asks you to add `--yes` (replace) or `--keep` (add).

## How it works (short)

- `npm run build` turns the pages in `site/` into plain files in `dist/`. Vercel serves those from its network.
- Every address that starts with `/api/` runs `api/[...path].js`, the one function. It contains the same routes as a normal server (`lib/routes/`), stored through `lib/storage/redis.js`.
- Booking and sign-in limits are counted in the database, so they hold even when Vercel runs several copies of the function.
- Alerts are sent **before** the function replies, because Vercel may pause a function the moment it answers.
- Photos are resized in the browser, then stored in the database (about 700 KB at most each) and cached by the CDN for a year.

## Keeping it healthy

- **Backups:** in the admin page, Settings, Alerts and backups, **Download a backup** now and then. It includes photos and never includes passwords. Restore with `npm run import-data`.
- **Updating the site:** change files, push to GitHub, Vercel deploys.
- **Logs:** Project, Logs shows errors and each request.
- **Costs:** watch Vercel's Usage page and Upstash's dashboard in the first month so you know your real numbers.

## If something looks wrong

| You see | What it means | What to do |
| --- | --- | --- |
| "FreshNest has nowhere to keep data yet" | No database is connected. | Step 3. Then redeploy. |
| Sign-in says the admin password has not been set up | `ADMIN_PASSWORD` is missing. | Step 4, then redeploy. |
| The website works but the admin page says it cannot reach the server | The function is failing, usually a database problem. | Project, Logs. Check the database is connected and not archived (Upstash dashboard). |
| A photo upload is refused as too big | The photo is still over 700 KB after resizing. | Choose a simpler or smaller photo. |
| Opening hours changed but Google still shows the old ones | Search engines see the hours from the last deploy. | Redeploy, or set `DEPLOY_HOOK_URL` so saving Settings does it for you. |
| Booking alerts do not arrive | No channel set up, or a wrong token. | Admin, Settings, **Send a test alert**: it shows which channel failed and why. |
| "Too many requests" for a customer | Six bookings an hour from one internet connection is the limit. | They can call or WhatsApp you; the limit lifts within the hour. |

## Good to know

- One shared admin password protects everything. It is not tied to individual staff.
- The admin dashboard shows the newest 500 bookings and reviews. Older ones stay in the database and in backups and exports.
- Passwords on Vercel always come from `ADMIN_PASSWORD`. To change it, change the variable and redeploy: everyone is signed out.
