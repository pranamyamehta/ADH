# Phone Tennis

Use your smartphone as a motion-sensing tennis racket. The game runs in any browser on a TV or large screen — players join from their phones by scanning a QR code or entering a 4-letter room code, then physically swing their phone to hit the ball.

No app installation required. Built with Node.js, WebSockets, HTML5 Canvas, and the DeviceMotion API.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Features](#features)
- [Getting Started](#getting-started)
- [Android / Fire TV Shell](#android--fire-tv-shell)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Hackathon Submission](#hackathon-submission)

---

## How It Works

The server relays messages between the TV screen and connected phones over WebSocket. The TV renders the game canvas and manages match state. Each phone acts as a wireless racket — the accelerometer detects physical swings and sends power and direction data to the TV in real time.

```
TV (tv.html)  ◄──────────────────────►  Node.js Relay (server.js)
                                                   │
              ◄──────────────────────►  Phone 1 (phone.html)
              ◄──────────────────────►  Phone 2 (phone.html)
```

| Component        | File                       | Role                                    |
| ---------------- | -------------------------- | --------------------------------------- |
| Relay server     | `tennis/server.js`         | WebSocket message relay, room management |
| TV game screen   | `tennis/public/tv.html`    | Canvas game engine, score HUD           |
| Lobby & setup    | `tennis/public/lobby.js`   | Room creation, player sync, match setup |
| Phone controller | `tennis/public/phone.html` | Motion racket, live stats, report card  |
| Fire TV shell    | `android/`                 | Native Android / Fire OS wrapper app    |

---

## Features

### TV Game Screen

**Lobby**

- Generates a random 4-letter room code on startup and displays it as a QR code
- Real-time player list updates as phones connect and submit their names
- Mode selection: vs AI (single player) or PvP (two phones)
- Rounds configuration: Best of 1, 2, or 3 (each round is first to 7 points)

**Game Engine**

- Full tennis court rendered on HTML5 Canvas — doubles lines, singles sidelines, service boxes, net with mesh, center hash marks
- 3D ball physics: the ball has a simulated `z` (height) axis with gravity, bounce dampening, and a shadow on the court surface
- Precision timing system — swings are graded and result in different shots:
  - **Perfect** — powerful, well-directed return
  - **Early** — cross-court, risky wide angle
  - **Late** — down the line, lower power
- Balls landing outside singles sidelines or baseline are called out; the point goes to the opponent
- 450ms cooldown between swings prevents spamming and forces real timing
- AI opponent moves at human-realistic speed with a ~12% unforced error rate
- Visual feedback: racket flash on hit, chalk bounce mark on landing, mid-court timing toasts (`PERFECT`, `OUT`, `WHIFF`, `CLEAN WINNER`)
- Keyboard fallback for testing: `F` / `B` for P1 forehand/backhand, `ArrowRight` / `ArrowLeft` for P2

**Match System**

- First to 7 points wins a round; match is best-of-1, 2, or 3
- Round-end celebration overlay before the next round begins
- Full per-player statistics compiled at match end and pushed to all connected phones

---

### Phone Controller

The phone interface has four sequential screens:

**1. Pairing**
Enter the room code manually or tap "Scan TV QR Code" to use the built-in camera scanner. Sharing the URL `phone.html?code=XXXX` auto-connects directly.

**2. Player Registration**
Enter a name (up to 16 characters). The name syncs to the TV scoreboard immediately over WebSocket.

**3. Active Racket**
Tap "Enable Motion Racket" to activate the accelerometer (iOS requires an explicit user gesture to grant `DeviceMotion` permission). A Screen Wake Lock is requested to keep the display on during play.

The live view shows:
- Real-time acceleration magnitude in m/s²
- Swing direction (forehand / backhand) and power after each detected swing
- Running totals: swings, estimated calories burned, peak power percentage
- A log of the last 6 swings with direction, power, and raw acceleration

Swing data is sent to the TV only when magnitude exceeds 16 m/s² and at least 450ms has elapsed since the last swing.

**4. Match Report Card**
Shown automatically when the TV signals the match is over. Displays:

| Metric             | Detail                                      |
| ------------------ | ------------------------------------------- |
| Energy expended    | Estimated kcal                              |
| Total swings       | With forehand / backhand split              |
| Hit accuracy       | Successful returns as % of total swings     |
| Peak swing speed   | Converted to km/h                           |
| Average power      | Mean power % across all swings              |
| Match duration     | Total seconds from first serve to last point |
| Intensity zone     | High Intensity / Cardio Active / Moderate   |

A "Download PDF" button generates a formatted A4 report card client-side using jsPDF — no server round-trip needed. When the TV host starts a new match, the phone resets automatically and returns to the racket screen.

---

### WebSocket Message Protocol

| Message    | Direction       | Description                                     |
| ---------- | --------------- | ----------------------------------------------- |
| `host`     | TV → Server     | Register as room owner, set room code and mode  |
| `join`     | Phone → Server  | Request to join a room by code                  |
| `joined`   | Server → Both   | Confirm join, assign player number              |
| `set_name` | Phone → Server  | Send player name; server relays to TV           |
| `swing`    | Phone → TV      | Swing power and direction                       |
| `report`   | TV → Phones     | Full match statistics at end of match           |
| `restart`  | TV → Phones     | Signal phones to reset for a new match          |
| `set_mode` | TV → Server     | Update room game mode                           |
| `error`    | Server → Phone  | Room not found or host disconnected             |

On disconnect, the server notifies all players if the TV host drops, and notifies the TV if a phone drops. The phone client reconnects automatically every 2 seconds.

---

## Getting Started

**Prerequisites**

- Node.js v18 or later
- One TV or large screen with a browser (Fire TV Silk Browser, Chrome, etc.)
- One or two smartphones (iOS or Android, modern browser)
- All devices on the same local network, or the server deployed behind HTTPS for remote play

**Install and run**

```bash
cd tennis
npm install
npm start
# Listening on http://localhost:3000
```

**Play**

1. Open `http://localhost:3000/tv.html` on the TV
2. Select game mode and number of rounds in the lobby
3. On each phone, go to `http://<server-ip>:3000/phone.html` and enter the room code, or scan the QR code on the TV
4. Enter your name, then tap "Enable Motion Racket"
5. Swing your phone when the ball reaches your side of the court

**Remote / HTTPS deployment**

DeviceMotion permission on iOS and WebSocket Secure (`wss://`) both require HTTPS. Deploy to any Node.js host (Render, Railway, Fly.io) and set the `PORT` environment variable as needed.

---

## Android / Fire TV Shell

The `android/` directory contains the native Android / Fire OS wrapper app that packages the game for Fire TV with fullscreen display, keep-screen-on flags, and hardware-accelerated WebView rendering.

### Build and Run Steps

1. Open the `android/` folder in **Android Studio**.
2. Configure your game URL in `app/src/main/java/com/volatiles/tennistv/MainActivity.kt`:
   ```kotlin
   private val GAME_URL = "https://<your-stable-host>/tv.html"
   ```
3. Connect your Fire TV device via ADB:
   ```bash
   adb connect <fire-tv-ip>:5555
   ```
4. Build the debug APK:
   - In Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
   - Or from the terminal:
     ```bash
     cd android
     ./gradlew assembleDebug
     ```
5. Install and launch on Fire TV:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```

---

## Project Structure

```
ADH/
├── android/            # Fire TV native Android shell app
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml
│   │   └── src/main/java/com/volatiles/tennistv/MainActivity.kt
│   ├── build.gradle.kts
│   └── settings.gradle.kts
└── tennis/
    ├── server.js           # WebSocket relay server
    ├── package.json
    └── public/
        ├── tv.html         # TV game screen and canvas engine
        ├── lobby.js        # Lobby UI, mode selection, results screen
        ├── phone.html      # Phone controller and match report card
        └── tv-test.html    # Minimal TV test harness
```

---

## Tech Stack

| Technology            | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| Node.js + Express     | HTTP server, static file serving                  |
| ws                    | WebSocket relay between TV and phones             |
| HTML5 Canvas          | Game rendering on the TV screen                   |
| DeviceMotion API      | Accelerometer input for physical swing detection  |
| DeviceOrientation API | Rotation rate for forehand / backhand detection   |
| Screen Wake Lock API  | Keeps phone screen on during active play          |
| html5-qrcode          | In-browser QR scanner on the phone               |
| qrcodejs              | QR code generation on the TV lobby screen        |
| jsPDF                 | Client-side PDF report card generation            |

---

## Hackathon Submission

*Build, Ship, Shape: Amazon Developer Hackathon 2026*

### Track

**Fire TV** — Sports & Fitness / Multi-modal UX

Phone Tennis runs in the Fire TV Silk Browser. The TV canvas is the game display; smartphones are the controllers. This fits directly into the Fire TV priority categories of sports, fitness, family entertainment, and multi-modal UX (TV screen + phone motion + QR pairing in a single flow).

**Mini Challenge: Open Source** — Full source code is published under the MIT License.

---

### What Was Built During the Submission Period

Phone Tennis was built from scratch during the submission window (August 31 – October 23, 2026).

| Feature                 | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| WebSocket relay server  | Bidirectional relay enabling TV ↔ Phone communication in real time      |
| Canvas game engine      | 3D-physics tennis court with AI opponent and full match state management |
| Precision timing system | PERFECT / EARLY / LATE classification with distinct shot outcomes        |
| DeviceMotion racket     | Phone accelerometer mapped to swing power and forehand/backhand direction |
| QR code pairing         | Camera-based room joining without manual IP or code entry               |
| Fitness tracking        | Live calorie estimate, swing counter, and peak power during play         |
| Match report card       | Per-player fitness summary with round-by-round score breakdown           |
| PDF export              | Client-side A4 report card generated via jsPDF                          |
| PvP multiplayer         | Two-phone simultaneous play with independent swing detection             |

---

### Product Feedback

**Tools and APIs used**

| Tool / API                | Usage                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Fire TV / Silk Browser    | Target display platform for the TV game screen                       |
| DeviceMotion API          | Phone accelerometer data for swing detection                          |
| DeviceOrientation API     | Rotation rate for forehand vs backhand classification                 |
| Screen Wake Lock API      | Prevents phone screen sleep during active play                        |
| WebSocket (ws library)    | Real-time relay between TV and phones                                 |
| html5-qrcode              | In-browser QR scanner on the phone controller                        |
| qrcodejs                  | QR code generation in the TV lobby                                   |
| jsPDF                     | Client-side PDF generation — no server round-trip                    |
| Node.js + Express         | Relay server and static file hosting                                  |

**What worked well**

WebSocket support in Silk Browser was reliable — connections were stable and swing data arrived with no perceptible latency. DeviceMotion on Android required no polyfill and tuned easily. QR code pairing turned out to be the best UX decision: pointing a phone at the TV and watching it join instantly is much smoother than typing a code. Canvas rendered at 60fps in Silk Browser without any platform-specific optimization.

**What needs work**

iOS requires a user gesture before `DeviceMotionEvent.requestPermission()` can be called, which forces an extra tap step that breaks the "instant play" feel after pairing. The Silk Browser has no published Web API compatibility list, so whether a given API is available has to be discovered by testing on hardware — a problem that would be much worse for less common APIs. The Wake Lock API releases silently when a tab loses visibility, and there is no clearly documented path for packaging a web app as a proper Fire TV launcher entry.

**Onboarding (zero to hello world)**

Setting up as an Amazon developer and getting a page loading in Silk Browser took about 3–4 hours total. Registering and enabling developer mode on the device were both well-documented. The harder part was navigating between the Fire TV, Web Apps, and Appstore submission sections of the developer portal — they are spread across different doc hubs without a single "web developer on Fire TV" quickstart guide. Rating: 6/10.

**Would you build with Fire TV again?**

Yes. The platform has a large installed base, Silk Browser is more capable than expected, and browser-native couch games have almost no competition in the Fire TV ecosystem. The phone-as-controller concept works naturally here in a way it wouldn't on a phone-only or desktop-only platform.

---

### Feature Requests

| Priority       | Request                                                  | Reason                                                                                          |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Critical       | Silk Browser Web API compatibility reference            | Developers currently have to test empirically on device; a published list would unblock an entire category of sensor-aware apps |
| Critical       | LAN device discovery for Fire TV web apps               | Manual IP entry is the biggest barrier to zero-config local multiplayer; even a basic mDNS hook would help significantly |
| Important      | Web app → Fire TV launcher packaging guide              | The current path requires piecing together Android WebView, ADB, and Appstore docs that were not written as a unified flow |
| Important      | D-pad / remote focus management guide for web apps      | The Fire TV remote is the primary input but there is no browser-specific guidance on focus rings or spatial navigation |
| Nice to have   | Persistent WebSocket across Silk Browser foreground transitions | Connections drop on app switch; a lifecycle event would make reconnect logic predictable rather than defensive |
| Nice to have   | Fire TV browser simulator with DevTools                 | Currently requires a physical device and `adb logcat`; a desktop simulator with network inspection would speed up iteration significantly |

---

### Friction Log

**Entry 1 — iOS DeviceMotion permission cannot be pre-requested**

- **Task:** Start the motion racket automatically when the player reaches the controller screen, without an extra tap
- **Steps taken:** Called `DeviceMotionEvent.requestPermission()` in `DOMContentLoaded`, in the WebSocket `joined` handler, and via a synthetic click dispatch
- **Expected:** Permission dialog appears immediately after pairing
- **Actual:** All calls outside a direct user gesture throw `NotAllowedError`
- **Severity:** Medium — forces a required extra tap that breaks the immediate-play UX
- **Workaround:** Added an explicit "Enable Motion Racket" button that satisfies the gesture requirement
- **Suggestion:** Allow a stored one-time permission grant after the first approval, similar to how camera and microphone permissions are not re-prompted on returning visits to trusted origins

---

**Entry 2 — No authoritative reference for Silk Browser Web API support**

- **Task:** Confirm which Web APIs are available in Silk Browser before writing code that depends on them
- **Steps taken:** Searched developer.amazon.com for "Silk Browser API support" (no results); searched broadly and found only scattered forum posts from 2018–2022; tested on device
- **Expected:** A compatibility table similar to MDN's browser compat data
- **Actual:** No official documentation exists; support must be discovered empirically
- **Severity:** High — a missing API found late in development could require architectural rework
- **Workaround:** Tested each required API on physical device early in the project
- **Suggestion:** Publish a Silk Browser Web API compatibility reference on developer.amazon.com, updated with each Fire OS release

---

**Entry 3 — Screen Wake Lock releases silently on tab switch**

- **Task:** Keep the phone screen on for the full duration of a match
- **Steps taken:** Acquired `WakeLockSentinel` via `navigator.wakeLock.request('screen')`; confirmed acquisition; switched tabs and returned
- **Expected:** Wake lock remains active
- **Actual:** Lock released silently when the tab lost visibility; no event fired until `wakeLockSentinel.released` was checked manually
- **Severity:** Low-Medium — screen dims after system timeout during active play
- **Workaround:** Added a `visibilitychange` listener that re-requests the lock when the page becomes visible
- **Suggestion:** Expose a proper `wakeLockLost` event so developers can reliably detect and re-acquire the lock without polling a property

---

## License

MIT — see [LICENSE](LICENSE).