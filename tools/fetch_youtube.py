#!/usr/bin/env python3
"""Rebuild data/sermons.json from the GateCity Buckhead YouTube playlists.

Uses YouTube's public RSS feeds, so there is no API key and no quota to manage:
    https://www.youtube.com/feeds/videos.xml?playlist_id=<PL...>
    https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>

Every series in data/series.json can name two playlists — `messages` (the
teaching on its own) and `full` (the whole service). Both get pulled; the app
lets a person choose which one to watch.

Human-entered fields (speaker, scripture, notes, blurb) are preserved across
runs: the feed only ever supplies title/date/thumbnail. Anything you type into
sermons.json by hand stays put.

    python3 tools/fetch_youtube.py            # refresh, write sermons.json
    python3 tools/fetch_youtube.py --dry-run  # show what would change
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Data sits inside docs/ because docs/ is what GitHub Pages publishes and what
# the service worker is scoped to; a sibling data/ would 404 on the live site.
DATA = ROOT / "docs" / "data"
FEED = "https://www.youtube.com/feeds/videos.xml?{}={}"
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}

# Fields the feed owns. Everything else in an existing entry survives a refresh.
FEED_OWNED = {"title", "date", "youtubeId", "thumb", "kind", "seriesId", "url"}


def fetch(kind, ident):
    url = FEED.format(kind, ident)
    req = urllib.request.Request(url, headers={"User-Agent": "gcb-app/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return ET.fromstring(r.read())
    except (urllib.error.URLError, ET.ParseError, TimeoutError) as e:
        print(f"  ! could not read {kind}={ident}: {e}", file=sys.stderr)
        return None


CHROME = re.compile(
    r"gatecity\s*buckhead|sunday morning service|worship\s*&\s*message|message only",
    re.I,
)
DATE_ONLY = re.compile(
    r"^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|[A-Z][a-z]+\.?\s+\d{1,2},?\s*\d{4})$"
)


def clean_title(raw):
    """Strip the channel's boilerplate but keep every part that names the message.

    The channel writes titles two different ways, and which side of the pipe
    matters flips between them:
        'Manifest Part 4 | GateCity Buckhead Sunday Morning Service 05/10/2026'
        'Journey Through James | Part 2: Desire, Deception, Divine Provision'
    So drop the segments that are boilerplate or a bare date, and keep the rest
    rather than assuming the title is always the first one.
    """
    keep = []
    for seg in raw.split("|"):
        seg = re.sub(r"\s*[-–]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*$", "", seg.strip()).strip()
        if not seg or CHROME.search(seg) or DATE_ONLY.match(seg):
            continue
        keep.append(seg)
    return " — ".join(keep) or raw.strip()


def title_date(raw):
    """A date typed in the title is the date the service happened; the feed's
    `published` is only when it was uploaded (often days later)."""
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", raw)
    if not m:
        return None
    mo, d, y = (int(x) for x in m.groups())
    try:
        return datetime(y, mo, d).strftime("%Y-%m-%d")
    except ValueError:
        return None


def entries(feed_root, series_id, kind):
    out = []
    for e in feed_root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        raw = (e.findtext("a:title", namespaces=NS) or "").strip()
        pub = e.findtext("a:published", namespaces=NS) or ""
        if not vid or not raw:
            continue
        date = title_date(raw) or (pub[:10] if pub else None)
        out.append({
            "youtubeId": vid,
            "title": clean_title(raw),
            "seriesId": series_id,
            "date": date,
            "kind": kind,
            "thumb": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
            "url": f"https://www.youtube.com/watch?v={vid}",
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    series = json.loads((DATA / "series.json").read_text())["series"]
    existing_path = DATA / "sermons.json"
    existing = {}
    if existing_path.exists():
        for s in json.loads(existing_path.read_text()).get("sermons", []):
            existing[s["youtubeId"]] = s

    manual_path = DATA / "manual_sermons.json"
    manual = json.loads(manual_path.read_text()).get("sermons", []) if manual_path.exists() else []

    found = {}
    for s in series:
        pls = s.get("playlists") or {}
        for kind, key in (("message", "messages"), ("service", "full")):
            pid = pls.get(key)
            if not pid:
                continue
            print(f"  {s['id']:<26} {key:<9} {pid}")
            root = fetch("playlist_id", pid)
            if root is None:
                continue
            for item in entries(root, s["id"], kind):
                # A video in both playlists keeps its richer 'service' entry only
                # if we haven't already filed it as the standalone message.
                if item["youtubeId"] not in found:
                    found[item["youtubeId"]] = item

    # A manual entry is either a whole sermon (a new series with no playlist yet)
    # or a patch onto one a playlist already supplied (usually to attach notes).
    # A patch whose youtubeId matches nothing would otherwise land as a record
    # with no title or date, so require the full set before keeping it.
    REQUIRED = ("title", "seriesId", "date", "kind")
    for m in manual:
        vid = m.get("youtubeId")
        if not vid:
            print("  ! manual entry with no youtubeId — skipped", file=sys.stderr)
            continue
        m.setdefault("thumb", f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg")
        m.setdefault("url", f"https://www.youtube.com/watch?v={vid}")
        combined = {**found.get(vid, {}), **m}
        missing = [k for k in REQUIRED if not combined.get(k)]
        if missing:
            print(f"  ! {vid} is not in any playlist and the manual entry is "
                  f"missing {', '.join(missing)} — skipped", file=sys.stderr)
            continue
        found[vid] = combined

    merged = []
    new_count = 0
    for vid, item in found.items():
        prior = existing.get(vid)
        if prior:
            keep = {k: v for k, v in prior.items() if k not in FEED_OWNED}
            merged.append({**item, **keep})
        else:
            new_count += 1
            merged.append(item)

    merged.sort(key=lambda s: (s.get("date") or "0000-00-00"), reverse=True)

    gone = [v for v in existing if v not in found]
    print(f"\n{len(merged)} sermons ({new_count} new, {len(gone)} no longer in a playlist)")
    if gone:
        print("  dropped: " + ", ".join(gone[:8]) + ("…" if len(gone) > 8 else ""))

    if args.dry_run:
        print("\n(dry run — nothing written)")
        return

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "YouTube playlist RSS via tools/fetch_youtube.py",
        "sermons": merged,
    }
    existing_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {existing_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
