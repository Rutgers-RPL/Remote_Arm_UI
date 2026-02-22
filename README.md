# ESP32 Avionics Command Console (Web BLE)

This project provides a high-fidelity, single-page web interface for controlling an ESP32 "Master" board via the Web Bluetooth API (BLE). Designed with a SpaceX-inspired "Dark Mode" aesthetic, it allows for real-time arming and monitoring of multiple hardware nodes (Master + Sub-Boards).

## Features

* **Secure Web Bluetooth Link:** Seamlessly connects to ESP32 hardware using the GATT protocol.
* **Dynamic Node Discovery:** Automatically generates UI controls based on the number of sub-boards reported by the Master.
* **Multi-Board Architecture:** Sidebar navigation allows switching between the "Master Unit" and various "Auxiliary Boards."
* **Avionics Control Grid:** 6 channels per board with high-visibility "ARM" and "SAFE" (Disarm) controls.
* **Real-Time Feedback Loop:** Visual status indicators (Red/Glowing Green) only update upon hardware confirmation, ensuring safety and accuracy.
* **Robust Data Handling:** Implements packet buffering to prevent command corruption during BLE transmission.
* **Responsive Ground Station UI:** Built with Tailwind CSS for a professional, mission-control feel.

## Technology Stack

* **Frontend:** HTML5, Tailwind CSS
* **Logic:** JavaScript (ES6+) with Web Bluetooth API
* **Firmware Compatibility:** ESP32 (Arduino/NimBLE-BLE)

## How to Run

### 1. Prerequisites
* **Browser:** Google Chrome, Microsoft Edge, or Bluefy (iOS).
* **Security:** Web Bluetooth **REQUIRES** a secure context. You must host this via `https://` or `localhost`. 
* **Hosting:** If using VS Code, use the **Live Server** extension. Simply opening the file (`file://...`) will **not** work.

### 2. Hardware Setup
Flash your ESP32 with the provided firmware. The UI is configured to look for these specific UUIDs:
* **Service UUID:** `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
* **Write Char UUID:** `beb5483e-36e1-4688-b7f5-ea07361b26a8`
* **Notify Char UUID:** `498c599b-ad01-4148-8a6a-73c332854747`

## Workflow & Usage

1.  **Establish Connection:** Click **ESTABLISH CONNECTION** and select your ESP32 (default name: "Ganesha-Master").
2.  **Syncing:** Upon connection, the UI automatically sends `SYNC_BOARDS`. The sidebar will populate based on the hardware response.
3.  **Commanding:** * Select a board from the sidebar.
    * Click **ARM** to activate a channel. The indicator will pulse green once the ESP32 confirms the state.
    * Click **SAFE** to disarm.
4.  **Re-Sync:** Use the **RE-SYNC ALL** button to force a status update of every channel across all connected nodes.

## Communication Protocol

The UI and ESP32 communicate using a newline-terminated (`\n`) string protocol to ensure data integrity.

| Command (UI -> ESP) | Description |
| :--- | :--- |
| `SYNC_BOARDS` | Requests total count of auxiliary boards. |
| `SYNC_ALL` | Requests status of every channel on every board. |
| `B[ID]_CH[N]_ARM` | Request to ARM Board ID, Channel N. |
| `B[ID]_CH[N]_DISARM` | Request to SAFE Board ID, Channel N. |

| Notification (ESP -> UI) | Description |
| :--- | :--- |
| `BOARDS:[X]` | Tells UI to render X auxiliary boards. |
| `B[ID]_CH[N]_ARMED` | Confirms Channel N on Board ID is now ARMED. |
| `B[ID]_CH[N]_DISARMED` | Confirms Channel N on Board ID is now SAFED. |

## Safety Note
This software is designed for telemetry and control. When used for high-power applications (e.g., rocket pyrotechnics), ensure your ESP32 firmware includes physical safety interlocks and failsafes. The UI provides "Optimistic UI" prevention—meaning it will only show a "Green" status once the hardware has confirmed the state change.

---
*Developed for Rocket Propulsion Lab Avionics Systems.*