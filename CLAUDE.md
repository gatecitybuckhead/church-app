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
Apple only allows iPhone installs through the App Store (TestFlight
expires, ad-hoc caps at 100, enterprise certs get churches banned). A
home-screen PWA installs straight from a link and can push-notify since
iOS 16.4. If GCB ever wants App Store presence, this codebase wraps later.

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

## The three scripts
```bash
python3 tools/fetch_youtube.py    # pull sermons from the channel's playlists
python3 tools/build.py            # validate everything + stamp the worker
python3 tools/check_new.py        # sermons on the channel the app is missing
```
`fetch_youtube.py` uses YouTube's public RSS feeds — no API key, no quota. It
**preserves anything typed by hand** (speaker, scripture, notes): the feed only
ever owns title/date/thumbnail/kind/series. Run `build.py` before publishing;
it exits non-zero on a broken link or a sermon pointing at a missing series.

`check_new.py` exists because `fetch_youtube.py` only reads playlists already
named in `series.json` — so a **brand-new series is invisible** until someone
adds it, and the app looks perfectly healthy while sitting a fortnight behind.
It compares the channel feed against `sermons.json`, ignores worship songs /
Ministry Time / podcast uploads, and exits 1 when a real sermon is missing.

## It keeps itself current
`church-app-refresh-tuesday` (CLI scheduler, Tuesdays ~9:24am) runs all three
scripts, publishes if anything changed, and texts Andrew only when there is
something to say. **Tuesday, not Monday** — the team often doesn't finish
uploading Sunday's video until Monday. The task must never invoke
`Publish to GitHub.command`, which waits on a keypress and would hang the run;
it pushes directly instead.

## Branding
Icon/header/share-card = the emerald gate mark from the **YouTube channel
avatar** (the Drive logo folder is empty; the only Drive file with this
mark says "GateCity Church" — the parent brand, not Buckhead). Regenerate
from a 900px+ square source with `sips`:

```bash
sips -s format png -Z 512 logo.png --out docs/icons/icon-512.png
sips -s format png -Z 192 logo.png --out docs/icons/icon-192.png
sips -s format png -Z 180 logo.png --out docs/icons/apple-touch-icon.png
sips -s format png -Z 368 logo.png --out /tmp/m.png            # maskable: ~72%
sips -s format png -p 512 512 --padColor FFFFFF /tmp/m.png --out docs/icons/maskable-512.png
sips -s format png -Z 430 logo.png --out /tmp/o.png            # share card
sips -s format png -p 630 1200 --padColor FFFFFF /tmp/o.png --out docs/icons/share-card.png
```

The mark is emerald-on-white, so `.mark` keeps a **white chip** behind it
(else it vanishes in dark mode).

**og:/twitter: tags in `index.html` hard-code absolute URLs**
(`https://gatecitybuckhead.github.io/church-app/`) — link previews are
fetched server-side. **If the app ever moves to a custom domain, move those
tags with it** or every shared link silently shows a broken preview.

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
- **Books ARE in the Library, with covers (Andrew, 8/13)** — free in-app
  PDFs even where they sell on Amazon (deliberate; everything in `docs/` is
  world-readable). `cover` field → bookshelf grid; covers at
  `docs/art/book-*.jpg`. All seven Hazen books in: four as free PDFs, three
  as Amazon links (no manuscript in Drive). Gotcha: a tabbed Google Doc
  exports with a junk "Tab 1" first page — strip with pypdf.
- **Notes belong on the sermon, not in the Library** (Andrew, 8/13/2026).
  The Library carries Books and Prayer Guides only; sermon notes reach people
  through the Notes button on the message they go with. Don't add a
  "Sermon Notes" category back to `resources.json` — a handful of loose
  handouts there reads as the whole collection when 45 are attached to
  sermons. The two James handouts still live in `docs/files/` because
  `manual_sermons.json` points at them.
- **Sermon-note PDFs: `docs/files/notes/YYYY-MM-DD-<slug>.pdf`** (45 as of
  8/13), attached via `notes` patches in `manual_sermons.json`. Sourced
  from SERMON OUTLINES folders; gdocs export via
  `docs.google.com/document/d/<ID>/export?format=pdf` (link-readable).
- "Prayer Leader Edition" guides are for leaders. The Library carries the
  general/plain editions only.
- `.back[hidden]` needs an explicit `display: none` in CSS — `display: grid`
  on `.back` outranks the browser's own `[hidden]` rule and the button never
  hides otherwise.

## Publishing
Double-click **Publish to GitHub.command** — runs `build.py`, refuses on
validation failure, commits, pushes with the token at
`AI Ops/gcb-github-token.txt`. Live at
`https://gatecitybuckhead.github.io/church-app/` ~a minute later.

**GitHub account = `gatecitybuckhead`; Andrew signs in via Google as
`production@gatecitybuckhead.com`** — never say "log in to GitHub" without
that, or he'll hunt for a credential that doesn't exist. Different account
from his personal `andrewfaletti`. The repo must stay **public** (Pages on
free accounts); the push token can push but cannot create repos.
