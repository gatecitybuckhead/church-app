#!/usr/bin/env python3
"""Check the app's data and stamp the service worker.

There is no compile step — the browser reads docs/data/*.json directly — so
this script exists to catch the mistakes that would otherwise only show up as a
blank section on someone's phone: a sermon pointing at a series that doesn't
exist, a Library entry pointing at a PDF nobody copied in.

It also rewrites SHELL_VERSION in sw.js to a hash of the shell files, so a
phone that already installed the app picks up a change instead of serving the
old cached copy forever.

    python3 tools/build.py
"""

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DATA = DOCS / "data"
SHELL = ["index.html", "app.css", "app.js"]

problems = []
notes = []


def load(name):
    path = DATA / name
    if not path.exists():
        problems.append(f"{name} is missing")
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        problems.append(f"{name} is not valid JSON — {e}")
        return {}


def main():
    config = load("config.json")
    series = load("series.json").get("series", [])
    sermons = load("sermons.json").get("sermons", [])
    resources = load("resources.json").get("resources", [])
    events = load("events.json").get("events", [])

    if not config.get("church", {}).get("name"):
        problems.append("config.json has no church name")

    ids = {s.get("id") for s in series}
    if len(ids) != len(series):
        problems.append("series.json has duplicate ids")

    for s in sermons:
        for key in ("youtubeId", "title", "seriesId", "date", "kind"):
            if not s.get(key):
                problems.append(f"sermon {s.get('youtubeId', '?')} is missing {key}")
        if s.get("seriesId") and s["seriesId"] not in ids:
            problems.append(f"sermon {s['youtubeId']} points at unknown series '{s['seriesId']}'")
        if s.get("kind") not in (None, "message", "service"):
            problems.append(f"sermon {s['youtubeId']} has kind '{s['kind']}' (expected message or service)")
        if s.get("notes") and not (DOCS / s["notes"]).exists():
            problems.append(f"sermon {s['youtubeId']} links notes that aren't there: {s['notes']}")

    for r in resources:
        url = r.get("url", "")
        if not url:
            problems.append(f"library item '{r.get('title', '?')}' has no url")
        elif not url.startswith("http") and not (DOCS / url).exists():
            problems.append(f"library item '{r.get('title')}' points at a missing file: {url}")

    for e in events:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", e.get("date", "")):
            problems.append(f"event '{e.get('title', '?')}' has a bad date: {e.get('date')}")

    empty = sorted(i for i in ids if not any(s.get("seriesId") == i for s in sermons))
    if empty:
        notes.append(f"{len(empty)} series have no sermons yet: {', '.join(empty)}")

    # Stamp the service worker so installed phones refresh their shell.
    sw = DOCS / "sw.js"
    digest = hashlib.sha256()
    for name in SHELL:
        digest.update((DOCS / name).read_bytes())
    version = "v" + digest.hexdigest()[:8]
    text = sw.read_text()
    current = re.search(r'const SHELL_VERSION = "([^"]+)"', text)
    if current and current.group(1) != version:
        sw.write_text(re.sub(r'(const SHELL_VERSION = ")[^"]+(")', rf"\1{version}\2", text, count=1))
        notes.append(f"service worker stamped {current.group(1)} -> {version}")

    print(f"{len(series)} series · {len(sermons)} sermons · "
          f"{len(resources)} library items · {len(events)} events")
    for n in notes:
        print(f"  note: {n}")
    for p in problems:
        print(f"  PROBLEM: {p}")
    if problems:
        print(f"\n{len(problems)} problem(s) — fix these before publishing.")
        sys.exit(1)
    print("\nAll good.")


if __name__ == "__main__":
    main()
