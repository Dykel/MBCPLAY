<div align="center">

<img src="assets/img/favicon.svg" width="88" alt="MBCPLAY logo">

# MBCPLAY

**Mauritian TV & radio, right in your browser.**

A lightweight, open-source web player for the MBC M3U playlist. Nothing to install: just open the page and press play.

[![Live player](https://img.shields.io/badge/▶_Watch_now-dykel.github.io%2FMBCPLAY-ff4d6d?style=for-the-badge)](https://dykel.github.io/MBCPLAY/)

![License: MIT](https://img.shields.io/badge/license-MIT-7b5cff)
![Channels](https://img.shields.io/badge/channels-11-ff4d6d)
![HLS](https://img.shields.io/badge/stream-HLS-13161e)

</div>

---

## ✨ Features

- **Plays in any modern browser**: Chrome, Edge, Firefox and Safari, on desktop and mobile
- **TV and radio** in one list, with TV / Radio filters and instant search
- **Channel logos**, a live indicator and an animated visualiser for radio
- **Remembers your last channel**, and each channel has a shareable link (for example `#mbc-1`)
- **Keyboard shortcuts**, picture-in-picture, fullscreen and media-key support
- **Auto-reconnect** when a stream drops
- **Bring your own playlist**: add `?playlist=<url>` to load any M3U file
- **Installable app (PWA)** for Android, iPhone and desktop, with a home-screen icon, full-screen launch and channel shortcuts

## 📺 Channels

| TV | Radio |
| --- | --- |
| MBC 1 · MBC 2 · MBC 3 · MBC 4 · MBC 5 | Radio Rodrigues |
| MBC 16 · MBC 17 · MBC SAT | |
| Sports 11 · MBC Rodrigues | |

## 🚀 How to watch

### In the browser
Open **https://dykel.github.io/MBCPLAY/** and pick a channel.

### 📱 Install it as an app
MBCPLAY is a Progressive Web App (PWA), so it installs straight from the website. There's no app store involved.

- **Android (Chrome, Edge, Samsung Internet):** open the site and tap **Install** in the pop-up at the bottom, or use the ⬇️ button in the top bar.
- **iPhone / iPad (Safari):** tap **Share** → **Add to Home Screen**.
- **Desktop (Chrome / Edge):** click the install icon in the address bar, or the **Install app** button.

The installed app opens full screen with its own icon. Long-press the icon to jump straight to MBC 1, MBC 2, Sports 11 or Radio Rodrigues.

### In VLC, Kodi, TiviMate or any IPTV app
Add this playlist URL:

```
https://raw.githubusercontent.com/Dykel/MBCPLAY/main/mbc.m3u
```

*VLC:* **Media → Open Network Stream…**, then paste the URL.

## ⌨️ Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Previous / next channel |
| <kbd>Space</kbd> | Play / pause |
| <kbd>M</kbd> | Mute / unmute |
| <kbd>F</kbd> | Fullscreen |
| <kbd>P</kbd> | Picture-in-picture |
| <kbd>/</kbd> | Search channels |

## 🗂️ Project structure

```
MBCPLAY/
├── index.html              # Player page
├── mbc.m3u                 # The playlist
├── manifest.webmanifest    # PWA manifest (name, icons, shortcuts)
├── sw.js                   # Service worker (app-shell cache; streams are never cached)
└── assets/
    ├── css/style.css       # Styles
    ├── js/app.js           # M3U parser and player logic (hls.js)
    ├── js/install.js       # Install button / banner
    └── img/                # Logo and app icons
```

## 🛠️ Run locally

```bash
git clone https://github.com/Dykel/MBCPLAY.git
cd MBCPLAY
python3 -m http.server 8000
```

Then open http://localhost:8000.

## ➕ Add or update a channel

Edit `mbc.m3u` and add an entry in this format:

```m3u
#EXTINF:-1 tvg-logo="https://example.com/logo.png",Channel Name
https://example.com/stream/master.m3u8
```

Channel names containing "Radio" or "FM" appear under the **Radio** tab automatically.

## ⚖️ Disclaimer

MBCPLAY is an **unofficial** project and is not affiliated with or endorsed by the Mauritius Broadcasting Corporation. It hosts no video or audio: it only links to publicly available streams. All channel names, logos and content belong to their respective owners.

## 📄 License

[MIT](LICENSE) © 2026 **Jonathan COLLET**
