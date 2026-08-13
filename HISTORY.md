# Church App — build notes

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

**Open items**
- Repo `gatecitybuckhead/church-app` isn't created yet, so nothing is pushed.
- GitHub Pages needs pointing at `main` → `/docs`.
- The books question above.
- `07_Marketing and Communications/01_Logos` is empty, so the icon is
  hand-generated. Swap it when a real logo lands.
- Noticed in passing: GCB already has Church Center
  (`gatecity-buckhead.churchcenter.com`) — worth auditing what it already
  covers before adding features here.
