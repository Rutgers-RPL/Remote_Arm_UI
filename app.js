/* ─────────────────────────────────────────────
   RRPL Remote Arm — BLE Logic (6-channel)
   ───────────────────────────────────────────── */

'use strict';

// ── BLE Constants ─────────────────────────────
const SERVICE_UUID     = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const WRITE_CHAR_UUID  = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const NOTIFY_CHAR_UUID = '498c599b-ad01-4148-8a6a-73c332854747';
const DEVICE_NAME      = 'RRPL Rocket';
const CHANNEL_COUNT    = 6;

// ── State ─────────────────────────────────────
let bleDevice           = null;
let writeCharacteristic = null;
let isConnected         = false;

// Per-channel armed state: index 0 = channel 1 … index 5 = channel 6
const channelArmed = new Array(CHANNEL_COUNT).fill(false);

// ── DOM (static) ──────────────────────────────
const btnConnect    = document.getElementById('btn-connect');
const btnClear      = document.getElementById('btn-clear');
const connBadge     = document.getElementById('conn-badge');
const connLabel     = document.getElementById('conn-label');
const masterStatus  = document.getElementById('master-status');
const masterCount   = document.getElementById('master-count');
const masterCaption = document.getElementById('master-caption');
const masterDots    = document.getElementById('master-dots');
const channelsGrid  = document.getElementById('channels-grid');
const consoleLog    = document.getElementById('console-log');
const footerTime    = document.getElementById('footer-time');

// ── Build Channel Cards ───────────────────────
// DOM refs for each channel, keyed by channel number (1-based)
const chRefs = {}; // { 1: { card, dot, stateLabel, btnArm, btnDisarm }, … }

for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
  // Master dot
  const dot = document.createElement('div');
  dot.className = 'master-dot';
  masterDots.appendChild(dot);

  // Channel card
  const card = document.createElement('div');
  card.className = 'channel-card';
  card.dataset.ch = ch;
  card.innerHTML = `
    <div class="channel-header">
      <span class="channel-id">CH 0${ch}</span>
      <span class="channel-status-dot" data-ch-dot="${ch}"></span>
    </div>
    <span class="channel-state-label" data-ch-label="${ch}">DISARMED</span>
    <div class="channel-actions">
      <button class="btn-ch btn-ch-arm"    data-ch-arm="${ch}"    disabled>ARM</button>
      <button class="btn-ch btn-ch-disarm" data-ch-disarm="${ch}" disabled>DISARM</button>
    </div>
  `;
  channelsGrid.appendChild(card);

  chRefs[ch] = {
    card,
    masterDot:  dot,
    dot:        card.querySelector(`[data-ch-dot="${ch}"]`),
    stateLabel: card.querySelector(`[data-ch-label="${ch}"]`),
    btnArm:     card.querySelector(`[data-ch-arm="${ch}"]`),
    btnDisarm:  card.querySelector(`[data-ch-disarm="${ch}"]`),
  };

  // Button listeners
  chRefs[ch].btnArm.addEventListener('click',    () => sendCommand(`B0_${ch}_ARM`));
  chRefs[ch].btnDisarm.addEventListener('click', () => sendCommand(`B0_${ch}_DISARM`));
}

// ── Service Worker ────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => log('Service worker registered', 'system'))
      .catch(err => log(`Service worker failed: ${err.message}`, 'error'));
  });
}

// ── UTC Clock ─────────────────────────────────
function updateClock() {
  const n = new Date();
  footerTime.textContent =
    `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} UTC`;
}
function pad(n) { return String(n).padStart(2, '0'); }
updateClock();
setInterval(updateClock, 1000);

// ── Console Logger ────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function log(message, type = 'system') {
  const n  = new Date();
  const ts = `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())}`;
  const ms = String(n.getUTCMilliseconds()).padStart(3, '0');

  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.innerHTML =
    `<span class="log-time">[${ts}.${ms}]</span>` +
    `<span class="log-msg">${escapeHtml(message)}</span>`;

  consoleLog.appendChild(entry);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

// ── BLE: Connect ──────────────────────────────
async function connectBLE() {
  if (!navigator.bluetooth) {
    log('Web Bluetooth API not available. Use Chrome or Edge.', 'error');
    return;
  }
  try {
    log('Requesting BLE device…', 'system');
    bleDevice = await navigator.bluetooth.requestDevice({
      filters:          [{ name: DEVICE_NAME }],
      optionalServices: [SERVICE_UUID],
    });

    log(`Device found: "${bleDevice.name}"`, 'system');
    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

    const server  = await bleDevice.gatt.connect();
    log('GATT server connected', 'system');

    const service = await server.getPrimaryService(SERVICE_UUID);
    writeCharacteristic = await service.getCharacteristic(WRITE_CHAR_UUID);

    const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID);
    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', onNotification);

    log('Notifications active. Ready.', 'system');
    setConnected(true);

  } catch (err) {
    const msg = err.name === 'NotFoundError'
      ? 'Device selection cancelled or not found.'
      : `Connection error: ${err.message}`;
    log(msg, err.name === 'NotFoundError' ? 'system' : 'error');
    setConnected(false);
  }
}

function onDisconnected() {
  log('Device disconnected.', 'error');
  writeCharacteristic = null;
  setConnected(false);
  // Reset all channels to disarmed
  for (let ch = 1; ch <= CHANNEL_COUNT; ch++) setChannelArmed(ch, false, false);
  updateMasterStatus();
}

// ── BLE: Send ─────────────────────────────────
async function sendCommand(cmd) {
  if (!writeCharacteristic) {
    log('Cannot send — not connected.', 'error');
    return;
  }
  try {
    await writeCharacteristic.writeValue(new TextEncoder().encode(cmd));
    log(`TX → ${cmd}`, 'tx');
  } catch (err) {
    log(`TX failed: ${err.message}`, 'error');
  }
}

// ── BLE: Receive ──────────────────────────────
// Expected notification format: B0_<N>_ARMED or B0_<N>_DISARMED
// Also handles plain ARMED / DISARMED (applies to all channels)
function onNotification(event) {
  const raw   = new TextDecoder('utf-8').decode(event.target.value).trim();
  const upper = raw.toUpperCase();

  // Try to parse channel-specific message: anything with _<digit>_
  const channelMatch = upper.match(/_(\d+)_(ARMED|DISARMED)/);

  if (channelMatch) {
    const ch    = parseInt(channelMatch[1], 10);
    const armed = channelMatch[2] === 'ARMED';
    const type  = armed ? 'armed' : 'rx';
    log(`RX ← ${raw}`, type);
    if (ch >= 1 && ch <= CHANNEL_COUNT) {
      setChannelArmed(ch, armed, true);
      updateMasterStatus();
    } else {
      log(`Unknown channel ${ch} in notification`, 'error');
    }
  } else if (upper.includes('DISARMED')) {
    // Generic DISARMED — apply to all channels
    log(`RX ← ${raw}  (applying to all channels)`, 'rx');
    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) setChannelArmed(ch, false, true);
    updateMasterStatus();
  } else if (upper.includes('ARMED')) {
    // Generic ARMED — apply to all channels
    log(`RX ← ${raw}  (applying to all channels)`, 'armed');
    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) setChannelArmed(ch, true, true);
    updateMasterStatus();
  } else {
    log(`RX ← ${raw}`, 'rx');
  }
}

// ── UI: Per-Channel State ─────────────────────
function setChannelArmed(ch, armed, flash = false) {
  channelArmed[ch - 1] = armed;
  const refs = chRefs[ch];
  if (!refs) return;

  if (armed) {
    refs.card.classList.add('armed');
    refs.dot.classList.add('armed');        // card dot - already handled by .channel-card.armed CSS
    refs.stateLabel.textContent = 'ARMED';
    refs.masterDot.classList.add('armed');
  } else {
    refs.card.classList.remove('armed');
    refs.dot.classList.remove('armed');
    refs.stateLabel.textContent = 'DISARMED';
    refs.masterDot.classList.remove('armed');
  }

  if (flash) {
    refs.card.classList.remove('flash');
    void refs.card.offsetWidth; // reflow
    refs.card.classList.add('flash');
  }
}

// ── UI: Master Status ─────────────────────────
function updateMasterStatus() {
  const armedCount = channelArmed.filter(Boolean).length;
  masterCount.textContent = `${armedCount}/${CHANNEL_COUNT}`;

  if (armedCount > 0) {
    masterStatus.classList.add('any-armed');
    masterCaption.textContent = `\u26A0 ${armedCount} CHANNEL${armedCount > 1 ? 'S' : ''} ARMED \u2014 FIRE CIRCUIT ENABLED`;
  } else {
    masterStatus.classList.remove('any-armed');
    masterCaption.textContent = isConnected
      ? 'SYSTEM SAFE \u2014 ALL CHANNELS DISARMED'
      : 'SYSTEM SAFE \u2014 AWAITING CONNECTION';
  }
}

// ── UI: Connected / Disconnected ─────────────
function setConnected(connected) {
  isConnected = connected;

  connBadge.classList.toggle('connected', connected);
  connLabel.textContent = connected ? 'CONNECTED' : 'DISCONNECTED';
  btnConnect.classList.toggle('connected', connected);
  btnConnect.querySelector('.btn-connect-text').textContent =
    connected ? 'DISCONNECT' : 'CONNECT';

  for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
    chRefs[ch].btnArm.disabled    = !connected;
    chRefs[ch].btnDisarm.disabled = !connected;
  }

  if (!connected) {
    bleDevice = null;
    updateMasterStatus();
  } else {
    masterCaption.textContent = 'SYSTEM SAFE \u2014 ALL CHANNELS DISARMED';
  }
}

// ── Connect button ────────────────────────────
btnConnect.addEventListener('click', () => {
  if (isConnected && bleDevice?.gatt.connected) {
    log('Disconnecting…', 'system');
    bleDevice.gatt.disconnect();
  } else {
    connectBLE();
  }
});

// ── Clear log ─────────────────────────────────
btnClear.addEventListener('click', () => {
  consoleLog.innerHTML = '';
  log('Log cleared.', 'system');
});

// ── Init ──────────────────────────────────────
updateMasterStatus();
log('RRPL Remote Arm initialized.', 'system');
log('Press CONNECT to pair with rocket.', 'system');

if (!navigator.bluetooth) {
  log('WARNING: Web Bluetooth not supported. Use Chrome or Edge.', 'error');
}
