/*!
 * MBCPLAY — install as an app (PWA)
 * (c) Jonathan COLLET — MIT License
 */
(() => {
  "use strict";

  const DISMISS_KEY = "mbcplay:install-dismissed";
  const DISMISS_DAYS = 7;

  const banner = document.getElementById("installBanner");
  const bannerBtn = document.getElementById("installBannerBtn");
  const hint = document.getElementById("installHint");
  const topBtn = document.getElementById("installBtn");
  const closeBtn = document.getElementById("installClose");

  const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobile = matchMedia("(max-width: 768px), (pointer: coarse)").matches;

  let deferredPrompt = null;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker failed:", err));
    });
  }

  if (isStandalone) return; // already running as an installed app

  function recentlyDismissed() {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY));
      return at && Date.now() - at < DISMISS_DAYS * 864e5;
    } catch (_) {
      return false;
    }
  }

  function showBanner() {
    if (!isMobile || recentlyDismissed()) return;
    // Give the page a moment so the banner doesn't cover the first impression.
    setTimeout(() => { banner.hidden = false; requestAnimationFrame(() => banner.classList.add("show")); }, 2500);
  }

  function hideBanner() {
    banner.classList.remove("show");
    setTimeout(() => { banner.hidden = true; }, 250);
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    topBtn.hidden = true;
    hideBanner();
    if (outcome === "dismissed") {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) { /* storage unavailable */ }
    }
  }

  // Chrome, Edge, Samsung Internet and other Chromium browsers.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    topBtn.hidden = false;
    showBanner();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    topBtn.hidden = true;
    hideBanner();
  });

  topBtn.addEventListener("click", promptInstall);
  bannerBtn.addEventListener("click", promptInstall);
  closeBtn.addEventListener("click", () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) { /* storage unavailable */ }
    hideBanner();
  });

  // iOS Safari has no install prompt, so explain the Share → Add to Home Screen steps.
  if (isIOS) {
    hint.innerHTML = 'Tap <svg class="share-icon" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9"/></svg> then <strong>Add to Home Screen</strong>.';
    bannerBtn.hidden = true;
    showBanner();
  }
})();
