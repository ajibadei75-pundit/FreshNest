# FreshNest Cleaning Services: website, booking system and admin

A complete, deployable site for Netlify: a fast static website, one serverless backend, an admin dashboard, and no database to set up.

**Services (8):** Residential, Office and Commercial, Deep, Hostel, Move-in and Move-out, One-time and Regular, Post-Construction, and **Fumigation and Pest Control**.
**Cities:** Ibadan, Oyo, Ogbomoso, Osogbo, Ilorin, Lagos (same prices everywhere). Open every day, 7am to 7pm.

---

## 1. Deploy in 10 minutes

1. Put this whole folder in a new GitHub repository (or GitLab/Bitbucket).
2. On [netlify.com](https://netlify.com): **Add new site > Import an existing project**, pick the repository.
   Netlify reads `netlify.toml`, so the defaults are right (publish folder `site`, functions in `netlify/functions`). Click **Deploy**.
3. Open **Site configuration > Environment variables** and add the settings in the table below. Then **Deploys > Trigger deploy**.
4. Visit `https://your-site.netlify.app/admin/` (also linked as **Staff login** in every page footer) and sign in with the username and password you set.
5. Make a test booking from your phone and check that the emails arrive.

> Prefer the command line? `npm install` then `npx netlify deploy --build --prod`.
> Netlify Drop (drag and drop) does **not** run the backend, so use Git or the CLI.

### Environment variables

| Name | Required | What it does |
|---|---|---|
| `ADMIN_USERNAME` | Yes | Admin username (defaults to `admin` if you leave it out; set your own). |
| `ADMIN_PASSWORD` | Yes | Admin password. Use a long one. |
| `AUTH_SECRET` | Recommended | Any long random string; signs admin sessions. |
| `RESEND_API_KEY` | For emails | From resend.com. Sends customer confirmations, receipts, checklists, reminders and your alerts. |
| `EMAIL_FROM` | For emails | For example `FreshNest Cleaning <bookings@yourdomain.com>`. Must be on a domain verified in Resend. |
| `SITE_URL` | Optional | Your public address (for email links), e.g. `https://www.yourdomain.com`. |
| `ANTHROPIC_API_KEY` | Optional | Turns the quote assistant from a keyword reader into an AI reader (see section 4). |
| `AI_MODEL` | Optional | Defaults to `claude-haiku-4-5-20251001`. |

**Email note:** Proton Mail cannot be used as the sending address. Verify a domain you own in Resend (it gives you DNS records to add), then use an address on that domain in `EMAIL_FROM`. Replies from customers go to `freshnestcleaningservices@proton.me`. Until email is set up, bookings still work and are saved; the admin page shows a notice.

---

## 2. What customers get

- **Booking in about two minutes**, five clear steps, a live price estimate, and a saved draft if they leave.
- **Quote assistant:** describe the place in plain words ("3-bedroom flat in Ibadan, greasy kitchen, deep clean on Saturday") and the form fills itself. They can change anything.
- **Written agreement:** the booking shows exactly what we will and will not do. *Everything stated is attended to; anything not stated is not done.* The same sentence is on the terms, the checklist, the receipt and the emails.
- **Terms must be read** (scroll to the end) before the agreement box unlocks.
- Confirmation emails, a booking tracker (reference plus phone or email), change and cancel requests, an add-to-calendar file, and a WhatsApp option.
- Welcome screen with the animated logo, day and night mode, and a layout that fits every device. On phones there is a **bottom bar** (Home, Services, Book now, Contact, Menu) and a compact logo, so every page is one tap away.

## 3. What you get in the admin (`/admin/`)

Sign in with your username and password.

- **Overview:** new bookings, money received and still owed, bookings over time, by service, city, weekday and time, funnel and reviews.
- **Schedule:** the next 30 days grouped by day, with jobs that have no team assigned flagged.
- **Bookings:** confirm with a final price, assign a team, update, complete, cancel, notes and a full timeline. Alerts bell with desktop notifications.
- **Draft quote message:** one click writes a friendly WhatsApp or email quote. The AI writes only a short friendly note; the price, date and scope lines always come from the booking.
- **Payments and receipts:** record cash, transfer or POS payments (numbered receipts `RC-2026-0001`), then preview, print or save as PDF, or email the receipt to the client. A statement shows the balance.
- **Checklists:** generated from the agreed scope (for fumigation it includes the safety steps). Untick items, add special requests, print or email to the client.
- **Content:** add previous work with before and after photos (drag-to-compare), and write guides.
- **Reviews:** approve customer feedback or add reviews you received elsewhere.
- **Settings:** business details, cities, opening hours, closed dates, booking rules, notifications, banner, and **every price** (including fumigation pests, hostel and office rooms).

## 4. Job planner for paint, tile and stain removal (built from your field manual)

Open **Admin > Planner**. It is a guided chat that asks the manual's pre-visit questions one at a time (area, cause and age of the stain, surface, access, occupancy, water and power, risks, who and what you can send, deadline and margin). You can answer in your own words or tap an option. It also starts from a booking: press **Plan this job** inside any booking and it reads the customer's notes first.

For every job it produces, on four tabs:

- **Quotation:** a customer-ready message (copy, WhatsApp, email) and a printable quotation. It includes the price, the manual's limits wording (no guarantee on porous grout, work stops if a test shows risk), the test-patch rule and the written scope. Customers never see your costs or margin.
- **Work procedure:** the right SOP from the manual for that stain and surface, the test-patch steps, PPE, tools and chemicals, machine steps, the quality check, stop-work conditions and the close-out list, plus a printable **job plan** with a job card.
- **Crew and machines:** how many leads, technicians and support to send, how many days it takes, and which of your machines to use or leave out, with the reason (for example, a pressure washer is never used on glass or indoor tile). If a deadline cannot be met with the people you have, it says how many more you need.
- **Costs:** labour, chemicals, transport, equipment-use charge, protection and waste, overhead and (only when uncertain) a contingency. Quote = cost divided by (1 minus margin), as in the manual. It also shows a per-m2 price, a day rate and the creditable test-patch fee.

The manual's safety rules are built in: epoxy and polyurethane coatings, acid-sensitive stone, coated or decorative glass, possible lead paint, work at height, and poor ventilation all raise STOP or CHECK flags, and the plan will tell you to pause, test first, or refer the job. The AI only helps read your answers and write a friendly opening line. **Every number comes from the calculator and your own settings, never from the AI.**

Set your real figures in **Admin > Settings > Job planner**: wages, how many people you have free, which machines you own (with price, resale value and lifetime hours: cost per hour uses the manual's formula), chemical cost and speed per stain, overhead, margin and minimum call-out. The starting values are only the manual's examples and my assumptions; the manual itself says to replace them with your measured figures after 5 to 10 jobs.

On the customer side, when someone describes paint or tile residue in the quote assistant, it asks the manual's follow-up questions (area, wet or dry, surface type).

## 5. The AI quote assistant

The assistant only **reads a description and fills in the form**. Prices always come from your fixed room-by-room rules, never from the AI, and it cannot invent a price. Everything it fills in is validated by the server.

- **Without a key:** a built-in keyword reader handles common descriptions (rooms, pests, city, dates like "tomorrow" or "next Saturday").
- **With `ANTHROPIC_API_KEY`:** the same endpoint asks Claude to read the description, and falls back to the keyword reader if the AI is unavailable. Usage is small (one short request per use, limited to 10 per visitor per hour).

## 6. Daily reminders

`netlify/functions/reminders.mjs` runs every day at 16:00 Nigerian time. It emails each customer with a **confirmed** job tomorrow, and sends you a digest of tomorrow's jobs. Change the schedule in that file if you like.

## 7. Prices

Change any price in **Admin > Settings**. Cleaning prices are anchored to 2026 Nigerian guide prices. **Fumigation has no fixed Nigerian rates**, so those numbers are sensible starting values (rooms, pests, outdoor area, severity). Please review them against your real costs.

## 8. Real photos and your own content

Use **Admin > Content** to add real jobs with before and after photos. Until you add work posts, the site shows only the starter guides.

## 9. Try it locally, no setup

```
python3 -m http.server 8000 --directory site
```
Open http://localhost:8000. With no backend running, a demo mode starts automatically and saves to the browser: nothing is sent. Demo admin login: **admin / demo1234**.

For the real backend locally: `npm install` then `npx netlify dev`.

## 10. Tests and checks

- `npm test`: 27 backend tests (bookings, validation, emails, admin, payments, receipts, checklists, fumigation, AI assistant, reminders, job planner).
- `python3 scripts/smoke.py`: loads every page at seven screen widths and checks for errors and sideways scrolling (needs Playwright; serve `site/` on port 8766).
- `python3 scripts/flow.py`, `python3 scripts/admin_flow.py` and `python3 scripts/planner_flow.py`: full customer, admin and job-planner journeys in a real browser.
- `python3 scripts/make_preview.py`: builds a one-file preview of the whole site and admin running in demo mode.

## 11. Folder map

```
site/                 the website (HTML, css, js, img)
  admin/index.html    admin dashboard
  js/core.js          backend logic (runs on Netlify and in the demo)
  js/pricing.js       prices and the estimate engine
  js/docs.js          receipts and checklists
  js/terms.js         booking terms and scope of work
  js/manual.js        the stain-removal field manual as data (SOPs, safety rules, questions)
  js/planner.js       job planner: crew, machines, time and cost calculator
netlify/functions/    api.mjs (backend), reminders.mjs (daily reminders)
netlify/lib/          storage (Netlify Blobs), email (Resend), AI (optional)
tests/                backend tests
scripts/              browser checks and the preview builder
```

## 12. Good to know

- **Legal:** the terms are a plain-language starting point. Have a lawyer review them before relying on them.
- **No online payments** by design. Payments are agreed with the customer and recorded in the admin, with a receipt for each.
- **Storage:** bookings, posts and photos are saved in Netlify Blobs (included with Netlify). Export bookings any time with **Export CSV**.
- **Privacy:** customers' details are used only to run the booking. The site counts anonymous visits and button taps only.
