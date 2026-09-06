# RoadCrew

Roadshow Schedule Management System

RoadCrew is a scheduling and proof-of-presence tool for a brand-activation agency. A client-service desk plans which promoter works which supermarket outlet on which days, each promoter sees only their own calendar and uploads a photo from the booth as proof they were there, and one admin account checks the month before promoter salary is paid.

Three roles, and the admin is the smallest of them:

| | Admin | Client service | Promoter |
|---|---|---|---|
| Schedules | reads all, edits none | own brand only, full edit | own assignments |
| Check-ins | reads all | own brand | uploads |
| Users, regions, settings | owns them | no | no |
| Accounts in the seed | 1 | 11 | 7 |

The admin is read-only on schedules by design, not oversight. That account exists to verify what actually happened before payroll, so it can open any schedule and see inside it but cannot change one. Planning belongs to the eleven client-service accounts, each assigned a single brand and working only that brand's roadshows.

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
| Admin | `admin@gmail.com` | `admin123` | Admin dashboard, read-only schedules |
| Client service · Kapal Api | `client1@gmail.com` | `admin123` | Kapal Api's schedules |
| Client service · Jasmine | `client2@gmail.com` | `admin123` | Jasmine's schedules |
| Client service · Pocky | `client3@gmail.com` | `admin123` | Pocky's schedules |
| Client service · Kewpie | `client4@gmail.com` | `admin123` | Kewpie's schedules |
| Promoter | `staff1@gmail.com` | `admin123` | Airene's calendar |
| Promoter | `staff2@gmail.com` | `admin123` | Johnny's calendar |

Open the login modal from **Log in** in the nav bar or in the hero. The modal lists these accounts too, and tapping a row fills the form.

Signing in as each of the four client accounts in turn is the quickest way to see brand scoping work: the same screen, a different list every time.

The seed carries eleven client-service accounts and eight promoters in total. The rest sit on `@roadcrew.demo` addresses and are data only — they can be scheduled, filtered and edited, but the demo box lists only the `@gmail.com` ones so the public page stays short. A deactivated account cannot sign in at all; the login says so rather than claiming the password is wrong.

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

A report password and a client-service login are **not** two keys to the same lock. The password is for the brand's own marketing people, who have no account here and only want last week's numbers; the login is for the Five Senses staff who plan that brand's work. One is read-only on a public page, the other is read-write inside the app.

> **This is a presentation gate, not access control.** The password is compared in the browser, so anyone can read it in the page source. Nothing sensitive sits behind it, and it should not be described to a client as securing anything.

---

## What is in it

**Public site** — `index.html`, one page with a sticky nav. Below 900px the sections move out of the top bar and into a fixed bottom tab bar, the same shape the promoter app uses, so a phone never has to open a menu to get around.

- **Home** — photo-led hero with a live stat card (units sampled, schedules, outlets) and the client list, all read from the store.
- **About** — a live numbers strip (brands, outlets, regions, promoters), then three photo-and-text rows: Schedule, Team, Proof.
- **Gallery** — a mosaic of six generated activation photographs (gpt-image-2), deliberately unbranded, with a lightbox.
- **Info** — a report card per brand with a blurred sparkline teaser of its week behind a lock, opened with that brand's password. That password is for the brand's own people, who have no account; it is not the client-service login.

**Admin** — a desktop shell that collapses to an icon rail, then to a phone layout with a bottom nav. Every admin page runs full bleed: there is no width cap, because a dashboard's job is to show more at once on a bigger screen. Settings is the exception — its form fields cap at a readable measure while its tables still use the room.

- **Main** — events this week, promoters on duty, check-ins done against duty days, unassigned slots, a Monday-to-Sunday week strip, today's check-in feed and region coverage for the month.
- **Schedules** — the seeded schedules as a table or a month calendar, filterable by brand, region, sub-region, promoter and status. Picking a region narrows the sub-region list under it. The table shows ten at a time with a count and page buttons underneath; the month calendar is not paged. **Read-only here** — there is no New button and no row actions, and a row click opens the drawer as a detail view with its fields disabled, because this account checks the month rather than plans it.
- **Users** — everyone with an account, active or inactive, with how many events each has this month. Two chip rows filter it: regions, then the sub-regions of whichever region is picked. Client-service rows carry their brand under the role. Paged ten at a time, the same way Schedules is.
- **Settings** — five tabs: company profile, brands, regions, check-in rules, and a reset that restores the seed. The open tab is written to the URL, so saving a brand keeps you on Brands and `settings.html#checkin` opens straight onto the check-in rules. On a phone the tab strip scrolls sideways rather than squeezing five labels into the width.
- **Settings → Regions** — three tables drilling down: regions, the sub-regions of the picked region, the outlets of the picked sub-region. Anything that still holds something refuses to be deleted and says how many — a region blocked by its sub-regions, a sub-region by its outlets *and* by the people assigned to it, an outlet by its schedules.

**Client service** — `client/schedules.html`, one page, because scheduling is the whole job. The same list, month view and drawer the admin reads, with the write put back and everything scoped to the account's own brand: no brand filter, since the list is one brand already, and a brand select in the drawer that is fixed rather than chosen. Conflict detection is the one thing that looks across every brand — a promoter booked by the Jasmine desk is just as unavailable to Kapal Api, and the warning says so without naming the other brand's row.

**Promoter** — a phone-first shell.

- **My Calendar** — today's duty with a check-in action, a month grid dotted on duty days and ticked where a photo already exists, and what is coming up.
- **Event detail** — upload a photo, add a note, submit. The open window and the per-event photo cap come from Settings.
- **My Uploads** — every photo, grouped by month.

---

## Structure

```
index.html          public site: home, about, gallery, info + three modals
404.html
admin/              dashboard, schedules (read-only), users, settings
client/             schedules — the client-service desk, one brand per account
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
- Everything is stored in the browser under `roadcrew.db.v2`, with the session under `roadcrew.session`. Use **Settings → Reset demo data** to start over. The key carries a version because regions became a three-level tree: the migration only ever *adds* what is missing, so it could not have repointed the old fields, and a fresh key was cleaner than a database half in each shape. The old `roadcrew.db` is deleted on first load.
- The stored database **migrates itself forward**. When the seed gains a collection, a record or a field, an existing browser picks it up on the next load — while anything you changed or created is left alone. A seeded record you delete now **stays** deleted: its id is tombstoned in `deletedIds` and the migration skips it. A reset clears the tombstones along with everything else.
- Uploaded photos are downscaled and kept as data URLs, so they survive a reload but stay small enough for `localStorage`.
- Dates are handled as local `YYYY-MM-DD` values throughout, never UTC, so a day never shifts.
- Status is derived from the real system date at render time, not stored, so the demo stays live rather than frozen.
- **Regions are three levels**: West Malaysia, East Malaysia and Singapore, holding Central / Southern / East Coast, Sabah / Sarawak, and Singapore. The flat list this demo started with became the middle level; nothing was renamed, it moved down a rung.
- The outlets seeded for **Sabah, Sarawak and Singapore are placeholders** — real chains that trade in each territory (Servay and City Grocer, Everrise and Ta Kiong, FairPrice and Sheng Siong) standing in until Five Senses sends the real list. Replace them before any number is shown against them.

---

## Design

Originally designed in Claude Design as `RoadCrew Screens.dc.html` — ten artboards covering the landing page, the admin desktop screens, the drawer, the three promoter screens and the three admin phone screens — then ported by hand to plain HTML, CSS and JavaScript.

The canvas shipped in navy and blue. This build is red: every colour the canvas carried inline is hoisted into CSS custom properties at the top of `css/base.css`, so the theme is one block to change rather than sixty scattered values.
