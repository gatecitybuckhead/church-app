# GCB Church App — Agent Brief

The congregation-facing app for GateCity Buckhead: every message, the teaching
library, and Sunday details. It's a **PWA** — a website people add to their
home screen, where it opens full-screen with its own icon. No App Store, no
Apple developer account, no review, no monthly platform fee. Dated build notes:
`HISTORY.md`.

This folder is its own git repo and is gitignored by the parent
`gatecity-buckhead-ai-ops` repo — same arrangement as `Team Hub/`, and for the
same reason: it publishes to GitHub Pages on the **GateCity Buckhead** GitHub
account, not Andrew's personal one.

## Why a PWA and not a real app
Apple only allows iPhone installs through the App Store. TestFlight expires
every 90 days, ad-hoc installs cap at 100 devices, and enterprise certificates
are for employees only — churches have had certs revoked for exactly this.
A home-screen PWA is the one route that installs straight from a link, and
since iOS 16.4 it can even do push notifications. If GCB ever wants App Store
presence, this same codebase can be wrapped later; nothing here is wasted.

## Shape
- **No build step for content.** The browser reads `docs/data/*.json` at
  runtime. Adding a sermon = edit JSON, push. `tools/build.py` only validates
  and stamps the service worker.
- **`docs/` is the whole published site.** GitHub Pages serves it, and the
  service worker is scoped to it. Data lives at `docs/data/` — NOT a sibling
  `data/`, which would 404 live and sit outside the worker's scope.
- Four tabs, hash-routed in `docs/app.js`: Home, Watch, Library, Connect.

## Content sources
| What | Where it comes from |
|---|---|
| Sermon video | YouTube channel `@GateCityBuckhead` (`UCPCYw3AOeXT5GInwE2RcRXA`) |
| Series | The channel's own playlists — each series has a "Message Only" and a "Worship & Message" playlist |
| Teaching PDFs | Shared drive `GateCity Buckhead and Collective/10_Content Library/`, copied into `docs/files/` |
| Events | Hand-picked from `02_Weekly Operating Docs/2026 At-a-Glance Calendar` |

**Never host the video.** It streams from YouTube; the app is a good menu over
it. Hosting sermon video would cost real money and solve nothing.

## The two scripts
```bash
python3 tools/fetch_youtube.py    # pull sermons from the channel's playlists
python3 tools/build.py            # validate everything + stamp the worker
```
`fetch_youtube.py` uses YouTube's public RSS feeds — no API key, no quota. It
**preserves anything typed by hand** (speaker, scripture, notes): the feed only
ever owns title/date/thumbnail/kind/series. Run `build.py` before publishing;
it exits non-zero on a broken link or a sermon pointing at a missing series.

`tools/make_icons.py` regenerates the home-screen icons (pure stdlib, no
Pillow). Replace it the moment the church's real logo lands in Drive —
`07_Marketing and Communications/01_Logos` is empty as of 8/13/2026.

## Hard-won details
- **A series with no playlist** (a brand-new one) goes in
  `docs/data/manual_sermons.json`. Entries there also patch playlist-sourced
  sermons — that's how the James handouts got attached to their messages. A
  patch whose `youtubeId` matches nothing gets skipped with a warning rather
  than written as a title-less record.
- **Titles are two different shapes on the channel** and the meaningful half
  flips between them: `Manifest Part 4 | GateCity Buckhead Sunday Morning
  Service 05/10/2026` versus `Journey Through James | Part 2: Desire…`.
  `clean_title()` drops boilerplate and bare-date segments and keeps the rest;
  don't "simplify" it back to taking the first segment.
- **A date in the title beats the feed's `published`**, which is the upload
  time and often days late.
- **Don't publish the At-a-Glance Calendar wholesale.** It's an internal staff
  doc — birthdays, finance meetings, staff retreats. `docs/data/events.json`
  carries only what the whole church is invited to.
- **Books are not in the Library yet, on purpose.** *Conversations* and *Seven
  Seeds* are sold on Amazon; posting the PDFs free would undercut that. They
  need Andrew's call — free in-app, or a "Buy on Amazon" link.
- "Prayer Leader Edition" guides are for leaders. The Library carries the
  general/plain editions only.
- `.back[hidden]` needs an explicit `display: none` in CSS — `display: grid`
  on `.back` outranks the browser's own `[hidden]` rule and the button never
  hides otherwise.

## Publishing
Double-click **Publish to GitHub.command**. It runs `build.py`, refuses to
publish if validation fails, commits, and pushes with the GateCity token at
`AI Ops/gcb-github-token.txt`. Live at
`https://gatecitybuckhead.github.io/church-app/` about a minute later.
