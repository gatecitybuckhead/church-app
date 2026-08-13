#!/usr/bin/env python3
"""Find sermons on the YouTube channel that the app doesn't know about.

`fetch_youtube.py` only reads the playlists named in series.json, so when the
church launches a NEW series its first week or two are invisible to the app
until someone adds the series. That's a silent failure — the app looks fine,
it's just quietly a fortnight behind. This is the check that catches it.

Reads the channel feed (latest ~15 uploads), drops anything that isn't a
sermon, and reports what's left that isn't already in sermons.json.

    python3 tools/check_new.py            # last 14 days
    python3 tools/check_new.py --days 30

Exit code is 0 when nothing is missing, 1 when something is — so a caller can
branch on it without parsing the text.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "data"
CHANNEL = "UCPCYw3AOeXT5GInwE2RcRXA"
FEED = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL}"
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}

# The channel posts far more than sermons. These are the recurring non-sermon
# formats: individual worship songs, altar/ministry moments, and the podcast.
NOT_A_SERMON = re.compile(r"ministry time|\bworship\b|podcast|recap|announcement", re.I)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    args = ap.parse_args()

    known = {s["youtubeId"] for s in json.loads((DATA / "sermons.json").read_text())["sermons"]}

    try:
        req = urllib.request.Request(FEED, headers={"User-Agent": "gcb-app/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            root = ET.fromstring(r.read())
    except (urllib.error.URLError, ET.ParseError, TimeoutError) as e:
        print(f"could not read the channel feed: {e}", file=sys.stderr)
        return 0  # a network blip is not a content problem; don't cry wolf

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    missing, skipped = [], 0

    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        title = (e.findtext("a:title", namespaces=NS) or "").strip()
        pub = e.findtext("a:published", namespaces=NS) or ""
        if not vid or not pub:
            continue
        try:
            when = datetime.fromisoformat(pub.replace("Z", "+00:00"))
        except ValueError:
            continue
        if when < cutoff or vid in known:
            continue
        if NOT_A_SERMON.search(title):
            skipped += 1
            continue
        missing.append((when.strftime("%Y-%m-%d"), vid, title))

    if not missing:
        print(f"Nothing missing (checked the last {args.days} days; "
              f"ignored {skipped} non-sermon uploads).")
        return 0

    print(f"{len(missing)} sermon(s) on the channel are NOT in the app:")
    for date, vid, title in missing:
        print(f"  {date}  {vid}  {title[:70]}")
    print("\nThese are usually a new series whose playlist doesn't exist yet.")
    print("Fix: add the series + its playlists to docs/data/series.json, or add")
    print("the video to docs/data/manual_sermons.json, then re-run fetch_youtube.py.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
