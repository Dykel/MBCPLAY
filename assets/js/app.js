/*!
 * MBCPLAY Web Player
 * (c) Jonathan COLLET — MIT License
 * https://github.com/Dykel/MBCPLAY
 */
(() => {
  "use strict";

  // Any M3U can be loaded with ?playlist=<url>; defaults to the playlist in this repo.
  const PLAYLIST_URL = new URLSearchParams(location.search).get("playlist") || "mbc.m3u";
  const STORAGE_KEY = "mbcplay:last-channel";
  const MAX_NETWORK_RETRIES = 3;

  const $ = (id) => document.getElementById(id);
  const els = {
    player: $("player"),
    video: $("video"),
    overlay: $("overlay"),
    overlayText: $("overlayText"),
    spinner: $("spinner"),
    retryBtn: $("retryBtn"),
    radioVisual: $("radioVisual"),
    radioLogo: $("radioLogo"),
    npLogo: $("npLogo"),
    npTitle: $("npTitle"),
    list: $("channelList"),
    empty: $("emptyState"),
    search: $("search"),
    toast: $("toast"),
  };

  let channels = [];
  let current = null;
  let hls = null;
  let networkRetries = 0;
  let filter = "all";

  // ---------- Playlist parsing ----------

  function parseAttributes(str) {
    const attrs = {};
    str.replace(/([\w-]+)="([^"]*)"/g, (_, key, value) => { attrs[key] = value; });
    return attrs;
  }

  // Splits an #EXTINF line on the first comma that is not inside quotes.
  function splitExtinf(line) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes;
      else if (line[i] === "," && !inQuotes) return [line.slice(0, i), line.slice(i + 1)];
    }
    return [line, ""];
  }

  function slugify(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function parseM3U(text) {
    const result = [];
    let pending = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("#EXTINF")) {
        const [head, name] = splitExtinf(line);
        const attrs = parseAttributes(head);
        pending = {
          name: (name || attrs["tvg-name"] || "Unknown").trim(),
          logo: attrs["tvg-logo"] || "",
          group: attrs["group-title"] || "",
        };
      } else if (!line.startsWith("#") && pending) {
        const isRadio = /radio|\bfm\b/i.test(`${pending.name} ${pending.group} ${line}`);
        result.push({ ...pending, url: line, type: isRadio ? "radio" : "tv", id: slugify(pending.name) });
        pending = null;
      }
    }
    return result;
  }

  // ---------- UI helpers ----------

  function showOverlay(text, { loading = false, retry = false } = {}) {
    els.overlayText.textContent = text;
    els.spinner.hidden = !loading;
    els.retryBtn.hidden = !retry;
    els.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
  }

  let toastTimer;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function initials(name) {
    return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  }

  function logoElement(ch) {
    const box = document.createElement("div");
    box.className = "channel-logo";
    if (ch.logo) {
      const img = document.createElement("img");
      img.src = ch.logo;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => { box.textContent = initials(ch.name); };
      box.appendChild(img);
    } else {
      box.textContent = initials(ch.name);
    }
    return box;
  }

  function renderList() {
    const query = els.search.value.trim().toLowerCase();
    els.list.replaceChildren();
    const visible = channels.filter((ch) =>
      (filter === "all" || ch.type === filter) && ch.name.toLowerCase().includes(query));

    for (const ch of visible) {
      const li = document.createElement("li");
      li.className = "channel" + (ch === current ? " active" : "");
      li.tabIndex = 0;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", ch === current);
      li.dataset.id = ch.id;

      const meta = document.createElement("div");
      meta.className = "channel-meta";
      const name = document.createElement("div");
      name.className = "channel-name";
      name.textContent = ch.name;
      const type = document.createElement("div");
      type.className = "channel-type";
      type.textContent = ch.type === "radio" ? "Radio" : "TV channel";
      meta.append(name, type);

      const eq = document.createElement("span");
      eq.className = "eq";
      eq.innerHTML = "<i></i><i></i><i></i>";

      li.append(logoElement(ch), meta, eq);
      li.addEventListener("click", () => play(ch));
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(ch); }
      });
      els.list.appendChild(li);
    }
    els.empty.hidden = visible.length > 0;
  }

  function updateNowPlaying(ch) {
    els.npTitle.textContent = ch.name;
    document.title = `${ch.name} — MBCPLAY`;
    if (ch.logo) {
      els.npLogo.src = ch.logo;
      els.npLogo.hidden = false;
      els.npLogo.onerror = () => { els.npLogo.hidden = true; };
    } else {
      els.npLogo.hidden = true;
    }

    const isRadio = ch.type === "radio";
    els.radioVisual.hidden = !isRadio;
    if (isRadio) els.radioLogo.src = ch.logo || "assets/img/favicon.svg";

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: ch.name,
        artist: "MBCPLAY · Live",
        artwork: ch.logo ? [{ src: ch.logo, sizes: "512x512" }] : [],
      });
    }
  }

  // ---------- Playback ----------

  function destroyHls() {
    if (hls) { hls.destroy(); hls = null; }
  }

  function startPlayback() {
    const attempt = els.video.play();
    if (attempt && attempt.catch) {
      attempt.catch((err) => {
        // Browsers block autoplay with sound until the user interacts with the page,
        // so fall back to muted playback and let the viewer turn the sound on.
        if (err.name !== "NotAllowedError") return;
        els.video.muted = true;
        els.video.play().then(() => toast("Playing muted — press M to turn the sound on")).catch(() => {
          showOverlay("Press play to start");
          hideOverlay();
        });
      });
    }
  }

  function play(ch) {
    if (!ch) return;
    current = ch;
    networkRetries = 0;
    updateNowPlaying(ch);
    renderList();
    history.replaceState(null, "", `#${ch.id}`);
    try { localStorage.setItem(STORAGE_KEY, ch.id); } catch (_) { /* storage unavailable */ }

    showOverlay(`Loading ${ch.name}…`, { loading: true });
    destroyHls();
    els.video.removeAttribute("src");

    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
      hls.loadSource(ch.url);
      hls.attachMedia(els.video);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries++;
          showOverlay(`Reconnecting… (${networkRetries}/${MAX_NETWORK_RETRIES})`, { loading: true });
          setTimeout(() => hls && hls.startLoad(), 1500 * networkRetries);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          destroyHls();
          showOverlay(`${ch.name} is unavailable right now.`, { retry: true });
        }
      });
    } else if (els.video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS play HLS natively.
      els.video.src = ch.url;
      startPlayback();
    } else {
      showOverlay("Your browser can't play HLS streams.", { retry: false });
    }
  }

  function step(delta) {
    if (!channels.length) return;
    const index = current ? channels.indexOf(current) : -1;
    play(channels[(index + delta + channels.length) % channels.length]);
  }

  // ---------- Events ----------

  els.video.addEventListener("playing", () => { hideOverlay(); els.player.classList.remove("paused"); });
  els.video.addEventListener("pause", () => els.player.classList.add("paused"));
  els.video.addEventListener("waiting", () => showOverlay("Buffering…", { loading: true }));
  els.video.addEventListener("error", () => {
    if (!hls && current) showOverlay(`${current.name} is unavailable right now.`, { retry: true });
  });

  els.retryBtn.addEventListener("click", () => play(current));
  $("prevBtn").addEventListener("click", () => step(-1));
  $("nextBtn").addEventListener("click", () => step(1));

  $("fsBtn").addEventListener("click", toggleFullscreen);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (els.player.requestFullscreen) els.player.requestFullscreen();
    else if (els.video.webkitEnterFullscreen) els.video.webkitEnterFullscreen();
  }

  $("pipBtn").addEventListener("click", togglePip);
  async function togglePip() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await els.video.requestPictureInPicture();
      else toast("Picture-in-picture isn't supported here");
    } catch (_) {
      toast("Start a channel first");
    }
  }

  $("copyPlaylist").addEventListener("click", async () => {
    const url = new URL(PLAYLIST_URL, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      toast("Playlist link copied — paste it into VLC or any IPTV app");
    } catch (_) {
      prompt("Copy the playlist URL:", url);
    }
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab);
      });
      filter = tab.dataset.filter;
      renderList();
    });
  });

  els.search.addEventListener("input", renderList);

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); step(-1); break;
      case "ArrowDown": e.preventDefault(); step(1); break;
      case " ":
        if (e.target.closest(".channel, button")) return;
        e.preventDefault();
        els.video.paused ? els.video.play() : els.video.pause();
        break;
      case "m": case "M": els.video.muted = !els.video.muted; toast(els.video.muted ? "Muted" : "Sound on"); break;
      case "f": case "F": toggleFullscreen(); break;
      case "p": case "P": togglePip(); break;
      case "/": e.preventDefault(); els.search.focus(); break;
    }
  });

  window.addEventListener("hashchange", () => {
    const ch = channels.find((c) => c.id === location.hash.slice(1));
    if (ch && ch !== current) play(ch);
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
  }

  // ---------- Boot ----------

  async function init() {
    showOverlay("Loading channels…", { loading: true });
    try {
      const res = await fetch(PLAYLIST_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      channels = parseM3U(await res.text());
    } catch (err) {
      showOverlay("Couldn't load the playlist.", { retry: false });
      console.error("Playlist error:", err);
      return;
    }

    if (!channels.length) {
      showOverlay("The playlist has no channels.");
      return;
    }

    renderList();

    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) { /* storage unavailable */ }
    const fromHash = channels.find((c) => c.id === location.hash.slice(1));
    const fromStorage = channels.find((c) => c.id === saved);
    const initial = fromHash || fromStorage;

    if (initial) {
      play(initial);
    } else {
      showOverlay(`${channels.length} channels ready — pick one to start watching`);
    }
  }

  init();
})();
