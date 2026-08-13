/* GateCity Buckhead app.
   A hash-routed single page. All content comes from ../data/*.json at runtime,
   so adding a sermon means editing JSON and pushing — no rebuild step. */

const DATA = "data/";
const state = { config: null, series: [], sermons: [], resources: [], events: [], ready: null };

const $ = (sel, root = document) => root.querySelector(sel);
const view = $("#view");

/* ---------- helpers ---------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // Build in local time on purpose: `new Date("2026-08-09")` parses as UTC and
  // renders as the 8th for everyone in Atlanta.
  return new Date(y, m - 1, d).toLocaleDateString("en-US",
    { month: "long", day: "numeric", year: "numeric" });
}

const seriesById = (id) => state.series.find((s) => s.id === id);
const sermonById = (id) => state.sermons.find((s) => s.youtubeId === id);

function sermonsFor(id) {
  return state.sermons.filter((s) => s.seriesId === id);
}

function latestSermon() {
  // Genuinely the newest thing, whatever kind it is. Preferring a message-only
  // cut here meant a brand-new series whose first week is only up as a full
  // service left the front page showing something two weeks stale.
  // sermons are already sorted newest-first; on a tie, the message cut wins.
  const newest = state.sermons[0];
  if (!newest) return undefined;
  return state.sermons.find((s) => s.date === newest.date && s.kind === "message") || newest;
}

function recentTeaching(limit) {
  // One row per sermon for the Home page. Most Sundays exist twice — a
  // "Message Only" cut and the full service — and listing both made the same
  // sermon show up two or three times in Recent. Keep the message cut, and
  // keep a service only when no message cut of it exists; message uploads lag
  // the service by up to two weeks, so that's the pairing window.
  const out = [];
  for (const s of state.sermons) {
    if (s.kind !== "message") {
      const d = new Date(s.date);
      const cut = state.sermons.find((m) => m.kind === "message" && m.seriesId === s.seriesId &&
        new Date(m.date) - d >= -864e5 && new Date(m.date) - d <= 14 * 864e5);
      if (cut) continue;
    }
    out.push(s);
    if (out.length === limit) break;
  }
  return out;
}

function upcoming(limit = 4) {
  // Compare against a local YYYY-MM-DD so an event stays listed all day on the
  // day it happens, rather than disappearing at midnight UTC.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return state.events
    .filter((e) => (e.date || "") >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

function eventsHTML(items) {
  return `<div class="card"><div class="info-list">
    ${items.map((e) => `<div class="item">${icon("cal")}
      <div><div class="k">${esc(e.title)}</div>
      <div class="v">${esc(prettyDate(e.date))}${e.note ? " · " + esc(e.note) : ""}</div></div></div>`).join("")}
  </div></div>`;
}

const ICONS = {
  gift: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7"/>',
  wave: '<path d="M18 11V6a1.6 1.6 0 0 0-3.2 0M14.8 10.5V4.6a1.6 1.6 0 0 0-3.2 0v5.9M11.6 10.5V5.6a1.6 1.6 0 0 0-3.2 0v7.6"/><path d="M8.4 13.2 7 11.5a1.7 1.7 0 0 0-2.6 2.1l3 4.3A6 6 0 0 0 18 15.4V11"/>',
  steps: '<path d="M4 20h5v-5h5v-5h5V5"/><path d="M4 20v-3M9 15h5"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r=".9" fill="currentColor" stroke="none"/>',
  play: '<rect x="2.5" y="4.5" width="19" height="15" rx="4"/><path d="M10 9.5l5 3-5 3z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1.4l2.4-2.4a5 5 0 0 0-7.1-7.1L11 5.3"/><path d="M14 11a5 5 0 0 0-7.1-.4L4.5 13a5 5 0 0 0 7.1 7.1L13 18.7"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 1.9"/>',
  cal: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  share: '<path d="M12 15V3M8.5 6.5 12 3l3.5 3.5"/><path d="M5 13v6.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V13"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.link}</svg>`;

function thumbImg(s, cls = "") {
  // hqdefault always exists; maxres often doesn't, so don't reach for it.
  return `<img src="${esc(s.thumb)}" alt="" loading="lazy" class="${cls}">`;
}

const artCache = {};

function seriesArt(seriesId) {
  // One image per series, so a list of messages reads as a series rather than
  // a wall of unrelated video stills. Real artwork when we have it; otherwise
  // the series' FIRST video, which is normally the launch graphic.
  if (seriesId in artCache) return artCache[seriesId];
  const s = seriesById(seriesId);
  let art = s?.art;
  if (!art) {
    const inSeries = sermonsFor(seriesId);
    art = inSeries.length ? inSeries[inSeries.length - 1].thumb : null;
  }
  artCache[seriesId] = art;
  return art;
}

function artImg(seriesId, fallback) {
  const src = seriesArt(seriesId) || fallback;
  return `<img src="${esc(src)}" alt="" loading="lazy">`;
}

/* ---------- data ---------- */

async function load() {
  const get = async (file, fallback) => {
    try {
      const r = await fetch(DATA + file, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch {
      return fallback;
    }
  };
  const [config, series, sermons, resources, events] = await Promise.all([
    get("config.json", {}),
    get("series.json", { series: [] }),
    get("sermons.json", { sermons: [] }),
    get("resources.json", { resources: [] }),
    get("events.json", { events: [] }),
  ]);
  state.config = config;
  state.series = series.series || [];
  state.sermons = sermons.sermons || [];
  state.resources = resources.resources || [];
  state.events = events.events || [];

  // Series order follows the newest sermon in each, so the current series is
  // always first without anyone maintaining a rank by hand.
  const newest = {};
  for (const s of state.sermons) {
    if (!newest[s.seriesId] || (s.date || "") > newest[s.seriesId]) newest[s.seriesId] = s.date || "";
  }
  state.series.sort((a, b) => (newest[b.id] || b.started || "").localeCompare(newest[a.id] || a.started || ""));
}

/* ---------- views ---------- */

function viewHome() {
  const c = state.config.church || {};
  const latest = latestSermon();
  const current = state.series[0];
  const links = (state.config.links || []).slice(0, 4);

  // The title sits under the image rather than on it: sermon titles here run
  // long enough to wrap over the play button when they're overlaid.
  const hero = latest ? `
    <a class="card" href="#/sermon/${esc(latest.youtubeId)}">
      <span class="thumb">
        ${thumbImg(latest)}
        <span class="badge">${latest.kind === "service" ? "Latest service" : "Latest message"}</span>
        <span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
      </span>
      <span class="card-body">
        <span class="meta">${esc(seriesById(latest.seriesId)?.title || "")} · ${esc(prettyDate(latest.date))}</span>
        <h3>${esc(latest.title)}</h3>
      </span>
    </a>` : `<div class="empty"><b>No messages yet</b>Run the sermon refresh to pull them in.</div>`;

  const recent = recentTeaching(4).map(rowHTML).join("");

  return `
    <h1>${esc(c.name || "Our Church")}</h1>
    <p class="sub">${esc(c.tagline || "")}</p>

    ${hero}

    <div class="card" style="margin-top:16px">
      <div class="info-list">
        <div class="item">${icon("clock")}
          <div><div class="k">${esc(c.serviceTime || "")}</div>
          <div class="v">Every week — come as you are.</div></div></div>
        <a class="item" href="${esc(c.mapUrl || "#")}" target="_blank" rel="noopener">${icon("pin")}
          <div><div class="k">${esc(c.venue || "")}</div>
          <div class="v">${esc(c.address || "")}</div></div></a>
      </div>
    </div>

    ${(() => { const up = upcoming(3); return up.length ? `<h2>Coming up</h2>${eventsHTML(up)}` : ""; })()}

    ${links.length ? `<h2>Quick links</h2><div class="quick">${links.map(linkHTML).join("")}</div>` : ""}

    ${current ? `
      <div class="section-head"><h2>Current series</h2>
        <a href="#/series/${esc(current.id)}">See all</a></div>
      <a class="series-card current" href="#/series/${esc(current.id)}" style="min-height:0">
        <span class="eyebrow">Now teaching</span>
        <span class="st" style="font-size:19px">${esc(current.title)}</span>
        <span class="v" style="color:var(--muted);font-size:13.5px">${esc(current.blurb || "")}</span>
      </a>` : ""}

    <div class="section-head"><h2>Recent</h2><a href="#/watch">All messages</a></div>
    <div class="rows">${recent}</div>

    ${installBanner()}
  `;
}

function linkHTML(l) {
  const external = /^https?:/i.test(l.url);
  return `<a href="${esc(l.url)}" ${external ? 'target="_blank" rel="noopener"' : ""}>
    <span class="qi">${icon(l.icon)}</span>
    <span><span class="qt">${esc(l.label)}</span><br><span class="qn">${esc(l.note || "")}</span></span>
  </a>`;
}

function rowHTML(s) {
  const ser = seriesById(s.seriesId);
  return `<a class="row" href="#/sermon/${esc(s.youtubeId)}">
    <span class="rt">${artImg(s.seriesId, s.thumb)}</span>
    <span class="info">
      <span class="meta">${esc(ser?.title || "")} · ${esc(prettyDate(s.date))}</span>
      <h3>${esc(s.title)}</h3>
    </span>
  </a>`;
}

function viewWatch() {
  const cards = state.series.map((s) => {
    // Count one kind, not both: a series with 8 messages and 6 full services
    // isn't "14 messages".
    const all = sermonsFor(s.id);
    const messages = all.filter((x) => x.kind === "message").length;
    const n = messages || all.length;
    const noun = messages ? "message" : "service";
    return `<a class="series-card" href="#/series/${esc(s.id)}">
      <span class="st">${esc(s.title)}</span>
      <span class="sm">${n} ${noun}${n === 1 ? "" : "s"}</span>
    </a>`;
  }).join("");

  return `
    <h1>Watch</h1>
    <p class="sub">Every message, by series.</p>
    <label class="search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <input id="q" type="search" placeholder="Search messages and series" autocomplete="off">
    </label>
    <div id="results"></div>
    <div id="browse">
      <h2>Series</h2>
      <div class="grid">${cards}</div>
    </div>
  `;
}

function wireSearch() {
  const q = $("#q"), results = $("#results"), browse = $("#browse");
  if (!q) return;
  q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    if (term.length < 2) { results.innerHTML = ""; browse.hidden = false; return; }
    browse.hidden = true;
    const hits = state.sermons.filter((s) =>
      s.title.toLowerCase().includes(term) ||
      (seriesById(s.seriesId)?.title || "").toLowerCase().includes(term)
    ).slice(0, 40);
    results.innerHTML = hits.length
      ? `<h2>${hits.length} result${hits.length === 1 ? "" : "s"}</h2><div class="rows">${hits.map(rowHTML).join("")}</div>`
      : `<div class="empty" style="margin-top:20px"><b>Nothing found</b>Try a series name like “James” or “Manifest”.</div>`;
  });
}

function viewSeries(id) {
  const s = seriesById(id);
  if (!s) return notFound();
  const all = sermonsFor(id);
  const messages = all.filter((x) => x.kind === "message");
  const services = all.filter((x) => x.kind === "service");
  // Only offer the toggle when both cuts actually exist for this series.
  const both = messages.length && services.length;
  const initial = messages.length ? "message" : "service";

  return `
    <span class="eyebrow">Series</span>
    <h1 style="margin-top:2px">${esc(s.title)}</h1>
    <p class="sub">${esc(s.blurb || "")}</p>
    ${both ? `<div class="chips" role="group" aria-label="What to watch">
      <button class="chip" data-kind="message" aria-pressed="true">Message only</button>
      <button class="chip" data-kind="service" aria-pressed="false">Full service</button>
    </div>` : ""}
    <div class="rows" id="serieslist" style="margin-top:14px">
      ${(initial === "message" ? messages : services).map(rowHTML).join("")}
    </div>
  `;
}

function wireSeries(id) {
  const chips = document.querySelectorAll(".chip[data-kind]");
  if (!chips.length) return;
  chips.forEach((chip) => chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    const kind = chip.dataset.kind;
    $("#serieslist").innerHTML = sermonsFor(id).filter((s) => s.kind === kind).map(rowHTML).join("");
  }));
}

function viewSermon(vid) {
  const s = sermonById(vid);
  if (!s) return notFound();
  const ser = seriesById(s.seriesId);
  const notes = s.notes
    ? `<a class="btn" href="${esc(s.notes)}" target="_blank" rel="noopener">${icon("doc")} Notes</a>` : "";

  return `
    <div class="player">
      <iframe src="https://www.youtube-nocookie.com/embed/${esc(s.youtubeId)}?rel=0&playsinline=1"
        title="${esc(s.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    </div>
    <span class="eyebrow" style="display:block;margin-top:16px">${esc(ser?.title || "")}</span>
    <h1 style="margin-top:4px;font-size:23px">${esc(s.title)}</h1>
    <p class="sub">${esc(prettyDate(s.date))}${s.speaker ? " · " + esc(s.speaker) : ""}${s.scripture ? " · " + esc(s.scripture) : ""}</p>
    <div class="actions">
      <button class="btn primary" id="shareBtn">${icon("share")} Share</button>
      <a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener">${icon("play")} YouTube</a>
      ${notes}
    </div>
    ${ser ? `<div class="section-head"><h2>More from ${esc(ser.title)}</h2></div>
      <div class="rows">${sermonsFor(ser.id).filter((x) => x.youtubeId !== vid).slice(0, 5).map(rowHTML).join("")}</div>` : ""}
  `;
}

function wireSermon(vid) {
  const btn = $("#shareBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const s = sermonById(vid);
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: s.title, url });
      else { await navigator.clipboard.writeText(url); btn.innerHTML = icon("share") + " Copied"; }
    } catch { /* the person dismissed the share sheet — nothing to report */ }
  });
}

function viewLibrary() {
  if (!state.resources.length) {
    return `
      <h1>Library</h1>
      <p class="sub">Teaching notes, study guides, and reading plans.</p>
      <div class="empty" style="margin-top:18px">
        <b>Nothing here yet</b>
        Drop PDFs into <code>docs/files/</code> and list them in
        <code>data/resources.json</code>, and they'll appear here.
      </div>`;
  }
  const groups = {};
  for (const r of state.resources) (groups[r.category || "Resources"] ??= []).push(r);

  return `
    <h1>Library</h1>
    <p class="sub">Teaching notes, study guides, and reading plans.</p>
    ${Object.entries(groups).map(([cat, items]) => {
      const shelf = items.filter((r) => r.cover);
      const rows = items.filter((r) => !r.cover);
      return `
      <h2>${esc(cat)}</h2>
      ${shelf.length ? `<div class="shelf">
        ${shelf.map((r) => `<a class="book" href="${esc(r.url)}" target="_blank" rel="noopener">
          <span class="cover"><img src="${esc(r.cover)}" alt="${esc(r.title)} cover" loading="lazy"></span>
          <span class="bt">${esc(r.title)}</span>
          <span class="bn">${esc(r.note || "")}</span></a>`).join("")}
      </div>` : ""}
      ${rows.length ? `<div class="card"><div class="info-list">
        ${rows.map((r) => `<a class="item" href="${esc(r.url)}" target="_blank" rel="noopener">${icon("doc")}
          <div><div class="k">${esc(r.title)}</div>
          <div class="v">${esc(r.note || "")}</div></div></a>`).join("")}
      </div></div>` : ""}`;
    }).join("")}
  `;
}

function viewConnect() {
  const c = state.config.church || {};
  const rhythms = state.config.rhythms || [];
  const links = state.config.links || [];

  return `
    <h1>Connect</h1>
    <p class="sub">${esc(c.tagline || "")}</p>

    <h2>Sundays</h2>
    <div class="card"><div class="info-list">
      <div class="item">${icon("clock")}<div><div class="k">${esc(c.serviceTime || "")}</div>
        <div class="v">Doors open before the service — come early and say hi.</div></div></div>
      <a class="item" href="${esc(c.mapUrl || "#")}" target="_blank" rel="noopener">${icon("pin")}
        <div><div class="k">${esc(c.venue || "")}</div><div class="v">${esc(c.address || "")}</div></div></a>
      ${c.parkingNote ? `<div class="item">${icon("link")}<div><div class="k">Parking</div>
        <div class="v">${esc(c.parkingNote)}</div></div></div>` : ""}
    </div></div>

    ${(() => { const up = upcoming(8); return up.length ? `<h2>Coming up</h2>${eventsHTML(up)}` : ""; })()}

    ${rhythms.length ? `<h2>Weekly rhythms</h2><div class="card"><div class="info-list">
      ${rhythms.map((r) => `<div class="item">${icon("clock")}
        <div><div class="k">${esc(r.name)}</div>
        <div class="v">${esc(r.when)} · ${esc(r.where)}</div></div></div>`).join("")}
    </div></div>` : ""}

    <h2>Go deeper</h2>
    <div class="quick">${links.map(linkHTML).join("")}</div>

    <p class="note">Add this app to your home screen — <a href="install.html" style="color:var(--brand);font-weight:650">here's how</a>.</p>
  `;
}

function notFound() {
  return `<div class="empty" style="margin-top:40px"><b>Not found</b>
    <a href="#/" style="color:var(--brand)">Back home</a></div>`;
}

/* ---------- install prompt (iOS) ---------- */

function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() {
  return window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
}

function installBanner() {
  if (!isIOS() || isStandalone() || localStorage.getItem("gcb-install-dismissed")) return "";
  return `<div class="banner" id="installBanner">
    <span>${icon("share")}</span>
    <span>Add GateCity to your home screen — <a href="install.html" style="color:var(--brand);font-weight:650">show me how</a></span>
    <button class="bx" id="installX" aria-label="Dismiss">✕</button>
  </div>`;
}

/* ---------- router ---------- */

const ROUTES = [
  [/^\/?$/, () => ({ html: viewHome(), tab: "home" })],
  [/^\/watch$/, () => ({ html: viewWatch(), tab: "watch", after: wireSearch })],
  [/^\/series\/(.+)$/, (id) => ({ html: viewSeries(id), tab: "watch", back: true, after: () => wireSeries(id) })],
  [/^\/sermon\/(.+)$/, (id) => ({ html: viewSermon(id), tab: "watch", back: true, after: () => wireSermon(id) })],
  [/^\/library$/, () => ({ html: viewLibrary(), tab: "library" })],
  [/^\/connect$/, () => ({ html: viewConnect(), tab: "connect" })],
];

async function render() {
  await state.ready;
  const path = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";

  let out = { html: notFound(), tab: null };
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) { out = fn(...m.slice(1)); break; }
  }

  view.innerHTML = out.html;
  $("#backBtn").hidden = !out.back;
  document.querySelectorAll(".tabbar a").forEach((a) =>
    a.classList.toggle("on", a.dataset.tab === out.tab));

  window.scrollTo(0, 0);
  out.after?.();

  const x = $("#installX");
  x?.addEventListener("click", () => {
    localStorage.setItem("gcb-install-dismissed", "1");
    $("#installBanner")?.remove();
  });
}

$("#backBtn").addEventListener("click", () => history.back());
addEventListener("hashchange", render);
addEventListener("scroll", () => {
  $("#topbar").classList.toggle("scrolled", window.scrollY > 4);
}, { passive: true });

view.innerHTML = `<div class="skeleton" style="height:200px;margin-top:20px"></div>
  <div class="skeleton" style="height:80px;margin-top:14px"></div>`;

state.ready = load();
render();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
