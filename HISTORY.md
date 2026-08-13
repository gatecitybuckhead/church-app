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

**Open items**
- Weekly auto-refresh of the sermon library is still not built. This is the
  highest-value remaining item: nobody will remember to run `fetch_youtube.py`,
  and an app whose newest message is three weeks old gets abandoned.
- A QR-code slide for a Sunday, pointing at `/install.html`. `Team Hub/tools/
  qr.py` is vendored and reusable.
- Series art for the other 16 series; speaker/scripture are still empty.
- Audit what Church Center (`gatecity-buckhead.churchcenter.com`) already
  covers before duplicating giving/registrations here.
