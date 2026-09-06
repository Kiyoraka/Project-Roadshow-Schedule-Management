# RoadCrew

Roadshow Schedule Management System

RoadCrew is a scheduling and proof-of-presence tool for a brand-activation agency. A coordinator plans which promoter works which supermarket outlet on which days, and each promoter sees only their own calendar and uploads a photo from the booth as proof they were there.

`index.html` is the **public site** — Home, About, Gallery and Info, with the working demo behind a login modal and a weekly sales report behind a per-brand password.

This repository is a **hardcoded demo**: plain HTML, CSS and JavaScript. No framework, no build step, no backend. All data lives in a seed file and persists to `localStorage`.

---

## Running it

Open `index.html` directly from disk, or serve the folder:

```
python -m http.server 8080
```

then visit <http://localhost:8080>.

Both work. Every page carries its own navigation markup and uses relative paths, so nothing depends on a server.

---

## Demo accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@gmail.com` | `admin123` | Admin dashboard |
| Promoter | `staff1@gmail.com` | `admin123` | Airene's calendar |
| Promoter | `staff2@gmail.com` | `admin123` | Johnny's calendar |

Open the login modal from **Log in** in the nav bar or in the hero. The modal lists these accounts too, and tapping a row fills the form.

The other five promoters in the seed are data only — they can be scheduled, filtered and edited, but they have no login.

---

## Campaign reports

The **Info** section of the landing page carries one report card per brand. Each opens with that brand's own password:

| Brand | Report password |
|---|---|
| Kapal Api | `kapalapi2026` |
| Jasmine | `jasmine2026` |
| Pocky | `pocky2026` |
| Kewpie | `kewpie2026` |

A report shows the total units sampled for the week, a chart of units per day, a ranked product-popularity chart, and a breakdown by outlet with the supervisor and promoter head-count.

The week is **derived, not configured**: the seven days ending on that brand's most recent recorded sale. Days without an activation are shown as zero rather than dropped, so the shape of a campaign stays honest.

Passwords are editable per brand in **Settings → Brands**.

> **This is a presentation gate, not access control.** The password is compared in the browser, so anyone can read it in the page source. Nothing sensitive sits behind it, and it should not be described to a client as securing anything.

---

## What is in it

**Public site** — `index.html`, one page with a sticky nav. Below 900px the sections move out of the top bar and into a fixed bottom tab bar, the same shape the promoter app uses, so a phone never has to open a menu to get around.

- **Home** — photo-led hero with a live stat card (units sampled, schedules, outlets) and the client list, all read from the store.
- **About** — a live numbers strip (brands, outlets, regions, promoters), then three photo-and-text rows: Schedule, Team, Proof.
- **Gallery** — a mosaic of six generated activation photographs (gpt-image-2), deliberately unbranded, with a lightbox.
- **Info** — a report card per brand with a blurred sparkline teaser of its week behind a lock, opened with that brand's password.

**Admin** — a desktop shell that collapses to an icon rail, then to a phone layout with a bottom nav. Every admin page runs full bleed: there is no width cap, because a dashboard's job is to show more at once on a bigger screen. Settings is the exception — its form fields cap at a readable measure while its tables still use the room.

- **Main** — events this week, promoters on duty, check-ins done against duty days, unassigned slots, a Monday-to-Sunday week strip, today's check-in feed and region coverage for the month.
- **Schedules** — the seeded schedules as a table or a month calendar, filterable by brand, region, promoter and status. The table shows ten at a time with a count and page buttons underneath; the month calendar is not paged. Creating or editing opens a drawer that warns about double-booking without ever blocking the save.
- **Users** — promoters by region, active or inactive, with how many events each has this month. Paged ten at a time, the same way Schedules is.
- **Settings** — four tabs: company profile, brands, check-in rules, and a reset that restores the seed. The open tab is written to the URL, so saving a brand keeps you on Brands and `settings.html#checkin` opens straight onto the check-in rules.

**Promoter** — a phone-first shell.

- **My Calendar** — today's duty with a check-in action, a month grid dotted on duty days and ticked where a photo already exists, and what is coming up.
- **Event detail** — upload a photo, add a note, submit. The open window and the per-event photo cap come from Settings.
- **My Uploads** — every photo, grouped by month.

---

## Structure

```
index.html          public site: home, about, gallery, info + three modals
404.html
admin/              dashboard, schedules, users, settings
staff/              calendar, event, uploads
css/                base (tokens and components), landing, admin, staff
js/                 data, util, auth, calendar, report + one script per page
img/                logo, avatars, check-in placeholders, gallery + about photographs
```

`js/data.js` holds the seed and the storage layer. `js/util.js`, `js/auth.js`, `js/calendar.js` and `js/report.js` are shared. Every page loads them in that order and its own script last.

`js/report.js` derives a brand's weekly report and draws its two charts as inline SVG — no chart library, consistent with the no-build-step rule.

---

## Notes

- **It is a working prototype, not a mockup.** Creating and editing schedules, adding and deactivating users, adding brands, changing settings and uploading check-in photos all write to `localStorage` and survive a reload. Nothing is hardcoded into the pages — every screen renders from the stored database.
- Everything is stored in the browser under `roadcrew.db`, with the session under `roadcrew.session`. Use **Settings → Reset demo data** to start over.
- The stored database **migrates itself forward**. When the seed gains a collection, a record or a field, an existing browser picks it up on the next load — while anything you changed or created is left alone. One trade-off: a *seeded* record you delete will come back on the next seed update.
- Uploaded photos are downscaled and kept as data URLs, so they survive a reload but stay small enough for `localStorage`.
- Dates are handled as local `YYYY-MM-DD` values throughout, never UTC, so a day never shifts.
- Status is derived from the real system date at render time, not stored, so the demo stays live rather than frozen.

---

## Design

Originally designed in Claude Design as `RoadCrew Screens.dc.html` — ten artboards covering the landing page, the admin desktop screens, the drawer, the three promoter screens and the three admin phone screens — then ported by hand to plain HTML, CSS and JavaScript.

The canvas shipped in navy and blue. This build is red: every colour the canvas carried inline is hoisted into CSS custom properties at the top of `css/base.css`, so the theme is one block to change rather than sixty scattered values.
