# RRPL Remote Arm

A single-page Progressive Web App (PWA) for controlling an RRPL Rocket ESP32 board via Web Bluetooth (BLE). Provides real-time arming and monitoring of 6 independent pyrotechnic channels from any Chromium-based browser.

## Features

- **Web Bluetooth (BLE):** Connects directly to the ESP32 using the GATT protocol — no drivers, no server.
- **6-Channel Control:** Individual ARM / DISARM buttons for each of the 6 channels, displayed in a 2×3 card grid.
- **Hardware-Confirmed Status:** Channel indicators only turn green after the ESP32 sends a confirmation notification. No optimistic UI.
- **Master Status Bar:** Live `X/6 CHANNELS ARMED` counter with per-channel dot indicators at a glance.
- **Telemetry Console:** Timestamped log of every TX command and RX notification with color-coded entries.
- **PWA / Offline Support:** A service worker caches all assets on first load so the app can be installed and used without an internet connection.

## Technology Stack

- **Frontend:** HTML5, CSS3 (custom, no framework)
- **Logic:** Vanilla JavaScript (ES6+), Web Bluetooth API
- **Offline:** Service Worker (Cache-First strategy)
- **Firmware Target:** ESP32 (Arduino / NimBLE)

## How to Run

### Prerequisites
- **Browser:** Google Chrome or Microsoft Edge (desktop or Android). Safari and Firefox do not support Web Bluetooth.
- **Secure Context:** Web Bluetooth requires `https://` or `localhost`. Opening `file://` directly will **not** work.
- **Local hosting:** Use the VS Code **Live Server** extension, or any static file server (e.g. `npx serve .`).

### Hardware Setup

Flash your ESP32 with firmware that exposes the following BLE profile:

| | UUID |
|---|---|
| **Service** | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` |
| **Write Characteristic** | `beb5483e-36e1-4688-b7f5-ea07361b26a8` |
| **Notify Characteristic** | `498c599b-ad01-4148-8a6a-73c332854747` |
| **Device Name** | `RRPL Rocket` |

## Usage

1. **Connect:** Click **CONNECT** and select `RRPL Rocket` from the browser's device picker.
   - The connection badge turns cyan, all 12 channel buttons become active.
2. **Arm a channel:** Click **ARM** on the desired channel card. The UI sends the command and waits for hardware confirmation.
3. **Disarm a channel:** Click **DISARM** on the desired channel card.
4. **Disconnect:** Click **DISCONNECT** (same button). All channels reset to disarmed in the UI.

## Communication Protocol

### Commands (UI → ESP32)

| Command | Action |
|---|---|
| `B0_<N>_ARM` | Request ARM on channel N (1–6) |
| `B0_<N>_DISARM` | Request DISARM on channel N (1–6) |

### Notifications (ESP32 → UI)

| Notification | UI Response |
|---|---|
| `B0_<N>_ARMED` | Channel N card turns green, master counter increments |
| `B0_<N>_DISARMED` | Channel N card turns red, master counter decrements |
| `ARMED` *(generic)* | All 6 channels set to armed |
| `DISARMED` *(generic)* | All 6 channels set to disarmed |

## PWA Installation

On the first visit (with an internet connection), the service worker caches all app assets. After that the app works fully offline and can be added to the home screen via the browser's "Install app" prompt.

> **Note:** `manifest.json` references `icon-192.png` and `icon-512.png`. Drop two PNG icons of those sizes into the project root for the install prompt to include an app icon.

## Safety Note

This software is a control interface only. For high-power pyrotechnic applications, ensure the ESP32 firmware implements physical safety interlocks and hardware failsafes independent of this UI. Status indicators update only on hardware confirmation — the UI will never show a channel as armed unless the ESP32 has explicitly confirmed it.

---
*Developed for RRPL Avionics Systems.*
