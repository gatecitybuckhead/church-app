# Church App — build notes

## 2026-08-26 — CLAUDE.md fat trim: detail moved here

Dropped specifics from CLAUDE.md, preserved:

- Book covers: Conversations uses the real KDP cover; the others are
  page-1 renders (no designed cover exists in Drive). Free-PDF books:
  Conversations, Seven Seeds, Strong, Transformed. Amazon-link books:
  Blessed to Be a Blessing (epub only in Drive), Manifest, Detox.
  Strong/Transformed exported from gdocs in
  `01_Books and Written Resources/`. pypdf installed via
  `pip3 install --user --break-system-packages pypdf`.
- Sermon notes sourcing: 2025 ones hand-made from
  `04_Sermons and Scripts/SERMON OUTLINES/`; the rest from
  `SERMON OUTLINES - Hannah Team Use/` gdocs (one wasn't link-readable —
  the Drive connector exported it).
- PWA rationale detail: TestFlight expires every 90 days; ad-hoc installs
  cap at 100 devices; enterprise certs are employees-only and churches
  have had them revoked.
- Team Hub password-protects because Pages repos must be public — same
  reason this repo is public.

## 2026-08-13 — built v1

Andrew asked what it would take to build a Life.Church-style app. Answer landed
on a **PWA**: a website people add to their home screen. Apple only permits
iPhone installs through the App Store — TestFlight builds expire every 90 days,
ad-hoc installs cap at 100 devices, and enterprise certs are employees-only
(Facebook and Google both lost theirs for stretching that). A home-screen web
app is the only route that installs from a plain link, and since iOS 16.4 it
can even push notifications. Cost: $0/month on GitHub Pages, versus $50–$300+
for Subsplash-class platforms.

**What got built**
- Four-tab app (Home / Watch / Library / Connect), hash-routed, mobile-first,
  light + dark, in `docs/`. Reads `docs/data/*.json` at runtime — no build step
  for content.
- `tools/fetch_youtube.py` — pulls the sermon library from the channel's own
  playlists over public RSS. No API key, no quota. **125 sermons across 19
  series** on the first run.
- `tools/build.py` — validates data and stamps the service worker.
- `tools/make_icons.py` — generates the home-screen icons with the stdlib only
  (no Pillow on this Mac). Emerald field, white gate arch.
- Service worker: cache-first shell, network-first content, so the app opens
  instantly and still works with no signal.
- `docs/install.html` — the "Add to Home Screen" walkthrough, iPhone and
  Android tabs, auto-selecting by device.

**What the channel gave us for free.** GCB already organises YouTube by series,
with a *Message Only* and a *Worship & Message* playlist per series. That maps
straight onto the data model, so the series list and the message/full-service
toggle are the channel's own structure, not something anyone has to maintain
twice.

**Content decisions made along the way**
- Copied into `docs/files/`: the two James session handouts and the general
  editions of the Holy Week and Pentecost prayer guides.
- **Left out, pending Andrew's call:** *Conversations* and *Seven Seeds* — both
  sold on Amazon, and posting the PDFs free would undercut that. "Prayer Leader
  Edition" guides are leader-only and stay out.
- Events are hand-picked. The At-a-Glance Calendar is an internal staff doc
  (birthdays, finance meetings, staff retreats) and must never be published as-is.

**Bugs found by looking at the rendered page, not the code**
- `.back[hidden]` stayed visible: `display: grid` on the class outranks the
  browser's own `[hidden] { display: none }`.
- Inline SVGs with no intrinsic size stretched to fill their flex rows — the
  calendar icons rendered about 150px tall.
- `<span class="card-body">` wrapping block content painted stray rounded
  fragments; the card internals needed explicit `display: block`.
- `clean_title()` first took everything left of the `|`, which silently threw
  away the real title on `Journey Through James | Part 2: …`. The channel uses
  two title shapes and the meaningful half flips between them.
- Series cards counted messages + full services together and called the total
  "messages" — Manifest read "14 messages" for 8 messages and 6 services.
- Attached a handout to `k93OEyvStSY` believing it was James Part 2; it's the
  Week 2 *worship* video. Part 2 is `jruysE2suqc`. `fetch_youtube.py` now
  refuses to write a record that has no title rather than creating a broken one.
- The quick links were guessed (`/give`, `/im-new`, `/next-steps`) and all
  three 404'd. Real paths pulled off the live site: `/pledge`, `/new-here`,
  `/get-connected`, `/buckcity-kids`.

### Later the same day — books, series art, publish prep

- **Andrew: post the books free.** *Conversations* (234pp, Hazen & Hannah
  Stevens) and *Seven Seeds for Flourishing* (139pp) are now in the Library as
  free downloads. Worth knowing: the Pages repo is public, so these are
  downloadable by anyone with the URL, not only the congregation.
- **One image per series on message rows**, replacing a wall of unrelated video
  stills. Real artwork for Family Matters, Journey Through James and Covered,
  pulled from `01_Current Service Assets` and `05_Special Services` and resized
  with `sips`. Every other series falls back to its FIRST video's thumbnail,
  which is normally the launch graphic — verified on Detox, where all four rows
  correctly share the Pt 1 image.
- **Home was showing a two-week-old message.** `latestSermon()` preferred a
  message-only cut over the actual newest sermon, so Family Matters launching
  as a full service on 8/9 left Journey Through James (8/1) on the front page.
  Now it takes the newest outright and labels the badge by kind.

### Launched — https://gatecitybuckhead.github.io/church-app/

Repo `gatecitybuckhead/church-app`, Pages serving `main` → `/docs`. Verified in
production: service worker active, shell cached, 125 sermons / 19 series / 6
library items, PDFs downloading.

**The push failure that ate an hour, and how to recognise it next time.**
Pushing to the new repo failed with `Permission to gatecitybuckhead/church-app
denied to gatecitybuckhead` — a 403 that reads like the *account* lacks rights,
which is nonsense when the account owns the repo. The real cause: fine-grained
tokens are scoped to a named list of repositories, and this one was created in
July for `team-hub` only. A new repo is not covered automatically.

Two things made it hard to see:
- `GET /repos/.../church-app` returned `permissions: {push: true}`, because
  that field reports the *user's* rights, not the token's.
- Reading the repo over the API worked fine — but only because the repo is
  public, so those reads never needed the token at all.

The diagnostic that actually settles it is an endpoint requiring token push
scope: `GET /repos/{owner}/{repo}/collaborators` returned 200 for `team-hub`
and 403 for `church-app`. Token is now "No expiration" with access to all
repositories. It still **cannot create repos** and **lacks the Pages
permission** — both remain manual browser steps.

**Real branding.** The icon, header mark and share card now use the church's
emerald gate hexagon, sourced from the YouTube channel avatar (900×900). The
Drive logo folder is empty and the only GateCity mark in Drive is the black
parent-brand "GateCity Church" lockup. `tools/make_icons.py` deleted.

Open Graph and Twitter tags added — they did not exist before, so a shared link
previewed as a bare grey URL. They necessarily hard-code the github.io address;
see the warning in CLAUDE.md before moving to a custom domain.

### Same day — it keeps itself current now

- **`church-app-refresh-tuesday`** (CLI scheduler, Tuesdays ~9:24am) runs
  fetch → build → check_new, publishes if anything changed, and texts Andrew
  only when there's something to say. **Tuesday, not Monday, at Andrew's
  call** — the team often hasn't finished uploading Sunday's video by Monday.
  It pushes directly and must never call `Publish to GitHub.command`, which
  waits on a keypress and would hang the run forever.
- **`tools/check_new.py`** closes the failure mode that would otherwise go
  unnoticed for weeks: `fetch_youtube.py` only reads playlists already named in
  `series.json`, so a brand-new series is invisible until someone adds it — the
  app looks healthy while running a fortnight behind. Family Matters already
  hit this and had to be added by hand. Verified the alarm actually fires by
  deleting a known sermon from `sermons.json` and watching it report the video
  by name and exit 1, then restoring.
- **James series art corrected.** It was showing the reading-plan scan
  (`James-Scan-Slide-1920x1080.png`). The real title slide came out of
  `James_Session_1_FINAL.key` (a Keynote file is a zip: `Data/image1-8.png`);
  the Session 2 `.pptx` carries the same art at `ppt/media/image-1-1.jpg`.

**A caching scare worth not repeating.** After deploying the new James art the
app still showed the old image through a hard reload, which looked like a
publishing bug. It wasn't: the file on the server was byte-identical to local,
and GitHub Pages serves assets with `cache-control: max-age=600`. It was the
browser's own image cache, and it self-heals in ten minutes. Before treating
stale assets as a bug, download what the server is actually serving and compare
— `curl -I` the asset and read the cache headers.

**Open items**
- A QR-code slide for a Sunday, pointing at `/install.html`. `Team Hub/tools/
  qr.py` is vendored and reusable.
- Series art for the other 16 series; speaker/scripture are still empty.
- Audit what Church Center (`gatecity-buckhead.churchcenter.com`) already
  covers before duplicating giving/registrations here.

## 8/13/2026 (evening) — Series art, bookshelf Library, 45 sermon-note PDFs
- Series art found in Drive for 15 of 16 art-less series; the 11 clean title
  graphics wired in (640×360 jpg in docs/art/). Still art-less: Just the Text
  (nothing exists in Drive), Bible Intensives / Intersection Sunday / State of
  the Church / ONE Year (only versions with dates or QR codes baked in —
  contact sheet was sent to Andrew for a call on those).
- Library: books + prayer guides now render as a cover bookshelf (`cover`
  field in resources.json → `.shelf` grid). Conversations uses its real KDP
  cover; Seven Seeds/Holy Week are page-1 renders (no designed cover exists).
- 45 outline PDFs attached to sermons (Conversations 1–9, SOTC ×2, Legacy
  1–10, B2BAB 1–4, Messiah 1–3, Start Strong 1–2, COH 1–3, W4W 1–3, Covered,
  Manifest 1–7). Unmatched, left out: Seven Seeds ×4 + Transformed ×8 (those
  series predate the app's series list), Conversations Pt 10 (no video in
  app), Legacy msg "Part 2" (YouTube title looks mislabeled — says "He has
  Set Eternity" but the 8/24 outline says that Sunday was "Stewarding Time";
  its notes went on the service video only).
- Gotcha for next time: Hannah's outline gdocs export unauthenticated via
  /export?format=pdf — except 3March8Outline, which needed the Drive
  connector. Google throttles ~1 export/sec; sleep between curls.
- Follow-up same evening: STRONG and TRANSFORMED were finished books hiding
  as gdocs in the books folder. Exported to PDF (Strong needed the Drive
  connector — not link-shared), stripped the "Tab 1" junk page with pypdf,
  page-1 covers, added to Library. All four Hazen books now in the app.
- Amazon covers: the real KDP covers for Seven Seeds (yellow/seedling),
  Transformed (butterfly on black), and Strong (blue mountains) were pulled
  from their Amazon listings (ASINs B0DX5244NC, B0DZ863ZX9, B0GM97RPG1 —
  from AMAZON REPORT xlsx + search) and replaced the page-1 renders.
  Conversations already had its KDP cover from Drive. Strong went on sale
  Feb 7, 2026 ($2.99 Kindle / $4.60 paperback) — so all four books both
  sell on Amazon AND are free PDFs in the app, per Andrew's call.
- Round 3: Hazen has SEVEN books on Amazon, not four. Added Blessed to Be a
  Blessing (B0G2FGMHMB, cover from Drive Marketing Comms/B2BAB/Book Cover),
  Manifest (B0H4SCD7LK) and Detox (B0H8GDKBY4) — those two have no
  manuscript in the shared drive, so their Library cards link to Amazon
  instead of a free PDF (only an epub exists for B2BAB). The "Legacy book"
  is the Legacy Prayer & Scripture Guide (10-week gdoc from Virtual
  Prayer/Legacy) — exported, Tab-1 stripped, filed under Prayer Guides.
- Home "Recent" fix (Andrew's catch): it listed the 4 newest videos of any
  kind, so a Sunday appeared twice — message cut AND full service (the
  services' vaguer YouTube titles read as duplicate "Part 1"s). New
  recentTeaching() keeps the message cut and shows a service only when no
  message cut exists within [-1, +14] days for that series (message uploads
  lag the Sunday). Watch/series pages were already right — they split the
  two cuts into tabs on purpose.
- Library trimmed to Books + Prayer Guides. The "Sermon Notes" category only
  ever held the 2 James handouts, which made the app look like it had 2 sets
  of notes when 45 are attached to sermons. Notes now reach people only via
  the Notes button on each message. The James PDFs stay in docs/files/ —
  manual_sermons.json points at them.
