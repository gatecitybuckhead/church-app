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
The home-screen icon, the header mark and the link-preview card are all the
church's own emerald gate mark, taken from the **YouTube channel avatar**
(`@GateCityBuckhead`, 900×900 on white) — the Drive logo folder
`07_Marketing and Communications/01_Logos` is empty, and the only file in Drive
carrying this mark says "GateCity **Church**" in black, which is the parent
brand rather than Buckhead. Regenerate from a 900px+ square source with `sips`:

```bash
sips -s format png -Z 512 logo.png --out docs/icons/icon-512.png
sips -s format png -Z 192 logo.png --out docs/icons/icon-192.png
sips -s format png -Z 180 logo.png --out docs/icons/apple-touch-icon.png
sips -s format png -Z 368 logo.png --out /tmp/m.png            # maskable: ~72%
sips -s format png -p 512 512 --padColor FFFFFF /tmp/m.png --out docs/icons/maskable-512.png
sips -s format png -Z 430 logo.png --out /tmp/o.png            # share card
sips -s format png -p 630 1200 --padColor FFFFFF /tmp/o.png --out docs/icons/share-card.png
```

The mark is emerald-on-white, so `.mark` in the header keeps a **white chip**
behind it — without that it disappears in dark mode.

**The og:/twitter: tags in `index.html` use absolute URLs**, because Messages
and WhatsApp fetch the page from their own servers where a relative path
resolves to nothing. That means they hard-code
`https://gatecitybuckhead.github.io/church-app/`. **If the app ever moves to a
custom domain, those tags have to move with it** or every shared link shows a
broken preview while the app itself works fine — a failure nobody notices for
weeks.

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
- **Books ARE in the Library, with covers, by Andrew's call (8/13/2026).**
  *Conversations* and *Seven Seeds* PDFs are free in-app even though both sell
  on Amazon. Library items with a `cover` field render as a clickable
  bookshelf grid (`.shelf` in app.css); items without one stay as list rows.
  Covers live at `docs/art/book-*.jpg` — Conversations uses the real KDP
  cover; the rest are page-1 renders because no designed cover exists
  anywhere in Drive. All four Hazen books are in: Conversations, Seven
  Seeds, Strong, Transformed. Strong/Transformed were exported straight
  from their gdocs in `01_Books and Written Resources/` — a Google Doc that
  uses tabs exports with a junk "Tab 1" first page; strip it with pypdf
  before shipping (installed via `pip3 install --user --break-system-packages pypdf`).
- **Sermon-note PDFs live in `docs/files/notes/`, named `YYYY-MM-DD-<slug>.pdf`**
  (45 of them as of 8/13/2026), attached to sermons via `notes` patches in
  `manual_sermons.json`. The 2025 ones are hand-made PDFs from
  `04_Sermons and Scripts/SERMON OUTLINES/`; the rest were exported from the
  Google Docs in `SERMON OUTLINES - Hannah Team Use/` via
  `https://docs.google.com/document/d/<ID>/export?format=pdf` — those docs are
  link-readable, no auth needed (one wasn't; the Drive connector exported it).
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

**The GitHub account is `gatecitybuckhead`, and Andrew signs in through
Google as `production@gatecitybuckhead.com`** — not with a GitHub
username/password. Any instruction that says "log in to GitHub" needs to say
"Continue with Google, as production@", or he'll go looking for a credential
that doesn't exist. This is a different account from his personal
`andrewfaletti`, which holds the three private estate repos.

The repo has to be **public** — GitHub Pages isn't available on private repos
for free accounts. That's also why Team Hub password-protects its pages rather
than relying on repo privacy. Everything in `docs/` is world-readable,
including the book PDFs, which was a deliberate call (8/13/2026).

Creating the repo is a manual step: the push token can push but cannot create
repositories.
