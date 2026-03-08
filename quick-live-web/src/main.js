import "./style.css";
import { GoogleGenAI, MediaResolution, Modality } from "@google/genai";

const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const FRAME_INTERVAL_MS = 750;
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 360;
const LOCATION_GEOCODE_THROTTLE_MS = 30000;
const NEARBY_REFRESH_MS = 45000;
const MIN_MOVE_METERS = 50;

const STORAGE_KEYS = {
  apiKey: "citylens-web-api-key",
  backendUrl: "citylens-web-backend-url",
  homeAddress: "citylens-web-home-address",
  preferences: "citylens-web-preferences",
  mode: "citylens-web-mode",
  sessionId: "citylens-web-session-id",
};

const MODES = {
  explorer: {
    emoji: "🧭",
    label: "Explorer",
    accent: "#6cf2be",
    prompt:
      "You are CityLens in Explorer mode, a lively local guide for curious travelers. Use the current camera view first for visual questions. Keep responses vivid but short. If location or nearby place context is provided later in the conversation, use it naturally. When the user asks for directions or recommendations, speak clearly and give only a few options.",
  },
  vision: {
    emoji: "👁",
    label: "Vision",
    accent: "#8fc6ff",
    prompt:
      "You are CityLens in Vision Assist mode, a calm visual guide for a low-vision user. Describe what the camera sees directly and concretely. Read visible text exactly. Call out hazards, obstacles, steps, and spatial layout using clock directions. Keep sentences short and steady.",
  },
  memory: {
    emoji: "🏠",
    label: "Memory",
    accent: "#ffb08f",
    prompt:
      "You are CityLens in Memory Companion mode. Speak warmly, slowly, and reassuringly. Give one instruction at a time. If home address, route, or location context is provided later, use it to guide the user home gently. If the user sounds uncertain, repeat calmly and keep instructions simple.",
  },
};

const EXPLORER_CATEGORIES = [
  { key: "food", label: "Food", emoji: "🍽" },
  { key: "events", label: "Events", emoji: "🎉" },
  { key: "landmarks", label: "Attractions", emoji: "🏛" },
];

const defaultSessionId =
  window.localStorage.getItem(STORAGE_KEYS.sessionId) || crypto.randomUUID();
window.localStorage.setItem(STORAGE_KEYS.sessionId, defaultSessionId);

const initialMode = window.localStorage.getItem(STORAGE_KEYS.mode) || "vision";

const state = {
  mode: MODES[initialMode] ? initialMode : "vision",
  active: false,
  connected: false,
  speaking: false,
  muted: false,
  sessionId: defaultSessionId,
  backendReachable: false,
  geoWatchId: null,
  mediaStream: null,
  session: null,
  ai: null,
  frameTimer: null,
  inputAudioContext: null,
  inputSourceNode: null,
  inputProcessorNode: null,
  inputSilenceNode: null,
  outputAudioContext: null,
  outputPlaybackTime: 0,
  playingSources: [],
  isStopping: false,
  currentLocation: null,
  locationName: "",
  nearby: null,
  activeExplorerCategory: "food",
  transcript: [],
  heardText: "-",
  answerText: "-",
  status: "Idle",
  statusKind: "neutral",
  homeAddress: window.localStorage.getItem(STORAGE_KEYS.homeAddress) || "",
  preferences: window.localStorage.getItem(STORAGE_KEYS.preferences) || "",
  lastGeocodeAt: 0,
  lastNearbyAt: 0,
  lastPushedLocationKey: "",
  lastPushedNearbyKey: "",
  memoryReminderTimer: null,
  memoryReminderHideTimer: null,
  memoryReminderVisible: false,
  latestDirection: null,
  pendingContextSaveTimer: null,
  lastAssistantLine: "",
};

function defaultBackendUrl() {
  const saved = window.localStorage.getItem(STORAGE_KEYS.backendUrl);
  if (saved) {
    return saved;
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8000";
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return `http://${host}:8000`;
  }
  return "";
}

const app = document.querySelector("#app");
app.innerHTML = `
  <main class="appShell">
    <aside class="controlDock">
      <div class="brandBlock">
        <span class="brandKicker">Gemini Live · Web</span>
        <h1>CityLens</h1>
        <p class="brandCopy">Camera, voice, and location in one web app. Direct Live session for audio/video, backend for nearby places and saved context.</p>
      </div>

      <section class="modeGrid" id="modeGrid">
        ${Object.entries(MODES)
          .map(
            ([key, value]) => `
              <button class="modeCard" data-mode="${key}" type="button">
                <span class="modeEmoji">${value.emoji}</span>
                <span class="modeText">
                  <strong>${value.label}</strong>
                  <span>${key === "explorer" ? "Traveler mode" : key === "vision" ? "Assistive mode" : "Guide-home mode"}</span>
                </span>
              </button>
            `
          )
          .join("")}
      </section>

      <section class="settingsCard">
        <label class="fieldLabel" for="apiKey">Gemini API Key</label>
        <input id="apiKey" class="fieldInput" type="password" placeholder="Paste API key" autocomplete="off" />

        <label class="fieldLabel" for="backendUrl">Backend URL</label>
        <input id="backendUrl" class="fieldInput" type="text" placeholder="Optional: http://localhost:8000" autocomplete="off" />

        <label class="fieldLabel" for="homeAddress">Home Address</label>
        <input id="homeAddress" class="fieldInput" type="text" placeholder="Used for Memory mode" autocomplete="off" />

        <label class="fieldLabel" for="preferences">Preferences</label>
        <textarea id="preferences" class="fieldInput fieldTextarea" placeholder="Budget, vibe, accessibility needs, dietary preferences"></textarea>
      </section>

      <div class="buttonRow">
        <button id="startBtn" class="actionButton primary" type="button">Start Live</button>
        <button id="stopBtn" class="actionButton" type="button" disabled>Stop</button>
      </div>

      <section class="metaGrid">
        <div class="metaCard">
          <span>Session</span>
          <strong id="sessionIdLabel"></strong>
        </div>
        <div class="metaCard">
          <span>Backend</span>
          <strong id="backendState">Optional</strong>
        </div>
      </section>
    </aside>

    <section class="stageShell">
      <video id="preview" autoplay playsinline muted></video>
      <canvas id="frameCanvas" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" hidden></canvas>
      <div class="atmosphere"></div>

      <div class="topBar">
        <div class="chip" id="locationChip">Location unavailable</div>
        <div class="chip modeChip" id="modeChip">Vision</div>
        <div class="chip statusChip" id="statusChip">Idle</div>
      </div>

      <div class="speakingPill hidden" id="speakingPill">Speaking</div>
      <div class="memoryPill hidden" id="memoryPill">I'm here with you.</div>
      <div class="directionPill hidden" id="directionPill">
        <span class="directionArrow" id="directionArrow">↑</span>
        <span class="directionText" id="directionText">Go straight</span>
      </div>

      <div class="explorerSidebar hidden" id="explorerSidebar">
        ${EXPLORER_CATEGORIES.map(
          (item) => `
            <button class="explorerButton" data-category="${item.key}" type="button">
              <span>${item.emoji}</span>
              <small>${item.label}</small>
            </button>
          `
        ).join("")}
      </div>

      <section class="explorerPanel hidden" id="explorerPanel">
        <div class="panelHeader">
          <span id="explorerPanelTitle">Food</span>
          <span id="explorerPanelMeta">Nearby picks</span>
        </div>
        <div class="panelList" id="explorerPanelList"></div>
      </section>

      <aside class="nearbyRail hidden" id="nearbyRail">
        <div class="panelHeader">
          <span>Nearby</span>
          <span id="nearbyMeta">Waiting for location</span>
        </div>
        <div class="nearbyGroups" id="nearbyGroups"></div>
      </aside>

      <footer class="bottomStack">
        <div class="liveStrip">
          <article class="liveCard">
            <span class="liveLabel">Heard</span>
            <p id="heardText">-</p>
          </article>
          <article class="liveCard">
            <span class="liveLabel">Answer</span>
            <p id="answerText">-</p>
          </article>
        </div>

        <div class="quickActionBar">
          <button id="muteBtn" class="quickButton" type="button">Mute</button>
          <button id="captureBtn" class="quickButton" type="button">Capture</button>
          <button id="homeBtn" class="quickButton hidden" type="button">Take Me Home</button>
        </div>

        <section class="transcriptPanel">
          <div class="panelHeader">
            <span>Live Transcript</span>
            <span>Recent messages</span>
          </div>
          <div class="transcriptLog" id="transcriptLog"></div>
        </section>
      </footer>
    </section>
  </main>
`;

const refs = {
  apiKeyInput: document.querySelector("#apiKey"),
  backendUrlInput: document.querySelector("#backendUrl"),
  homeAddressInput: document.querySelector("#homeAddress"),
  preferencesInput: document.querySelector("#preferences"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  previewEl: document.querySelector("#preview"),
  canvasEl: document.querySelector("#frameCanvas"),
  locationChip: document.querySelector("#locationChip"),
  modeChip: document.querySelector("#modeChip"),
  statusChip: document.querySelector("#statusChip"),
  speakingPill: document.querySelector("#speakingPill"),
  memoryPill: document.querySelector("#memoryPill"),
  directionPill: document.querySelector("#directionPill"),
  directionArrow: document.querySelector("#directionArrow"),
  directionText: document.querySelector("#directionText"),
  heardTextEl: document.querySelector("#heardText"),
  answerTextEl: document.querySelector("#answerText"),
  transcriptLog: document.querySelector("#transcriptLog"),
  explorerSidebar: document.querySelector("#explorerSidebar"),
  explorerPanel: document.querySelector("#explorerPanel"),
  explorerPanelTitle: document.querySelector("#explorerPanelTitle"),
  explorerPanelMeta: document.querySelector("#explorerPanelMeta"),
  explorerPanelList: document.querySelector("#explorerPanelList"),
  nearbyRail: document.querySelector("#nearbyRail"),
  nearbyMeta: document.querySelector("#nearbyMeta"),
  nearbyGroups: document.querySelector("#nearbyGroups"),
  sessionIdLabel: document.querySelector("#sessionIdLabel"),
  backendState: document.querySelector("#backendState"),
  muteBtn: document.querySelector("#muteBtn"),
  captureBtn: document.querySelector("#captureBtn"),
  homeBtn: document.querySelector("#homeBtn"),
  modeGrid: document.querySelector("#modeGrid"),
};

refs.apiKeyInput.value = window.localStorage.getItem(STORAGE_KEYS.apiKey) || "";
refs.backendUrlInput.value = defaultBackendUrl();
refs.homeAddressInput.value = state.homeAddress;
refs.preferencesInput.value = state.preferences;

function normalizeBackendUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function setStatus(message, kind = "neutral") {
  state.status = message;
  state.statusKind = kind;
  refs.statusChip.textContent = message;
  refs.statusChip.dataset.kind = kind;
}

function getCurrentModeConfig() {
  return MODES[state.mode];
}

function updateModeUI() {
  const modeConfig = getCurrentModeConfig();
  window.localStorage.setItem(STORAGE_KEYS.mode, state.mode);
  refs.modeChip.textContent = `${modeConfig.emoji} ${modeConfig.label}`;
  refs.modeChip.style.setProperty("--mode-accent", modeConfig.accent);
  refs.homeBtn.classList.toggle("hidden", state.mode !== "memory");
  refs.explorerSidebar.classList.toggle(
    "hidden",
    !(state.active && state.mode === "explorer")
  );
  refs.explorerPanel.classList.toggle(
    "hidden",
    !(state.active && state.mode === "explorer")
  );
  refs.nearbyRail.classList.toggle(
    "hidden",
    !(state.active && state.mode === "explorer")
  );

  for (const button of refs.modeGrid.querySelectorAll(".modeCard")) {
    button.classList.toggle("selected", button.dataset.mode === state.mode);
    if (button.dataset.mode === state.mode) {
      button.style.setProperty("--card-accent", modeConfig.accent);
    }
  }

  renderDirection();
  renderExplorerPanel();
  renderNearby();
}

function appendTranscript(role, text) {
  const content = text?.trim();
  if (!content) {
    return;
  }
  const previous = state.transcript[state.transcript.length - 1];
  if (previous && previous.role === role && previous.text === content) {
    return;
  }
  state.transcript.push({ role, text: content });
  state.transcript = state.transcript.slice(-10);
  renderTranscript();
}

function renderTranscript() {
  refs.transcriptLog.innerHTML = state.transcript
    .map(
      (item) => `
        <div class="transcriptLine ${item.role}">
          <span>${item.role === "assistant" ? "AI" : item.role === "system" ? "App" : "You"}</span>
          <p>${escapeHtml(item.text)}</p>
        </div>
      `
    )
    .join("");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function floatTo16BitPcm(float32Array) {
  const pcm = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

function downsampleBuffer(buffer, inputRate, outputRate) {
  if (inputRate === outputRate) {
    return buffer;
  }

  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stopPlayback() {
  for (const source of state.playingSources) {
    try {
      source.stop();
    } catch {}
  }
  state.playingSources = [];
  state.speaking = false;
  refs.speakingPill.classList.add("hidden");
  if (state.outputAudioContext) {
    state.outputPlaybackTime = state.outputAudioContext.currentTime;
  }
}

async function ensureOutputAudioContext() {
  if (!state.outputAudioContext) {
    state.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  }
  if (state.outputAudioContext.state !== "running") {
    await state.outputAudioContext.resume();
  }
}

async function playPcmChunk(base64Pcm) {
  await ensureOutputAudioContext();

  const bytes = base64ToBytes(base64Pcm);
  const pcm16 = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    Math.floor(bytes.byteLength / 2)
  );
  const audioBuffer = state.outputAudioContext.createBuffer(
    1,
    pcm16.length,
    OUTPUT_SAMPLE_RATE
  );
  const channel = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm16.length; i += 1) {
    channel[i] = pcm16[i] / 0x8000;
  }

  const source = state.outputAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(state.outputAudioContext.destination);
  state.outputPlaybackTime = Math.max(
    state.outputPlaybackTime,
    state.outputAudioContext.currentTime + 0.03
  );
  source.start(state.outputPlaybackTime);
  state.outputPlaybackTime += audioBuffer.duration;

  state.playingSources.push(source);
  state.speaking = true;
  refs.speakingPill.classList.remove("hidden");
  source.onended = () => {
    state.playingSources = state.playingSources.filter((item) => item !== source);
    if (state.playingSources.length === 0) {
      state.speaking = false;
      refs.speakingPill.classList.add("hidden");
    }
  };
}

function buildSystemInstruction() {
  const modeConfig = getCurrentModeConfig();
  const homeLine =
    state.homeAddress.trim() && state.mode === "memory"
      ? `The user's saved home address is: ${state.homeAddress.trim()}.`
      : "";
  const preferenceLine = state.preferences.trim()
    ? `User preferences: ${state.preferences.trim()}.`
    : "";
  return [modeConfig.prompt, homeLine, preferenceLine]
    .filter(Boolean)
    .join(" ");
}

function buildSilentContext(text) {
  return `Context update only. Do not acknowledge this update out loud unless the user asks about it. ${text}`;
}

function sendSilentContext(text) {
  if (!state.session || !text.trim()) {
    return;
  }
  state.session.sendClientContent({
    turns: [{ role: "user", parts: [{ text: buildSilentContext(text) }] }],
  });
}

function sendPrompt(text) {
  if (!state.session || !text.trim()) {
    return;
  }
  appendTranscript("system", text);
  state.session.sendClientContent({
    turns: [{ role: "user", parts: [{ text }] }],
    turnComplete: true,
  });
}

function nearbySummaryText() {
  if (!state.nearby) {
    return "";
  }
  const sections = [];
  for (const [key, label] of [
    ["food", "Food"],
    ["landmarks", "Landmarks"],
    ["events", "Events"],
  ]) {
    const items = state.nearby[key] || [];
    if (!items.length) {
      continue;
    }
    sections.push(
      `${label}: ${items
        .map((item) => `${item.name} (${item.walk || item.address || "nearby"})`)
        .join(", ")}`
    );
  }
  return sections.join(" ");
}

function maybePushLocationContext() {
  if (!state.session || !state.currentLocation) {
    return;
  }
  const placeText = state.locationName ? ` Place: ${state.locationName}.` : "";
  const key = `${state.currentLocation.lat.toFixed(4)},${state.currentLocation.lng.toFixed(4)}|${state.locationName}`;
  if (key === state.lastPushedLocationKey) {
    return;
  }
  state.lastPushedLocationKey = key;
  sendSilentContext(
    `[GPS_UPDATE] lat=${state.currentLocation.lat.toFixed(5)}, lng=${state.currentLocation.lng.toFixed(5)}.${placeText}`
  );
}

function maybePushNearbyContext() {
  if (!state.session || !state.nearby) {
    return;
  }
  const summary = nearbySummaryText();
  if (!summary || summary === state.lastPushedNearbyKey) {
    return;
  }
  state.lastPushedNearbyKey = summary;
  sendSilentContext(`Preloaded nearby spots for the user: ${summary}`);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function getBackendUrl() {
  return normalizeBackendUrl(refs.backendUrlInput.value);
}

async function pingBackend() {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    state.backendReachable = false;
    refs.backendState.textContent = "Off";
    refs.backendState.dataset.kind = "neutral";
    return false;
  }

  try {
    await fetchJson(`${backendUrl}/`);
    state.backendReachable = true;
    refs.backendState.textContent = "Connected";
    refs.backendState.dataset.kind = "good";
    return true;
  } catch {
    state.backendReachable = false;
    refs.backendState.textContent = "Unavailable";
    refs.backendState.dataset.kind = "bad";
    return false;
  }
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function refreshLocationName(force = false) {
  const backendUrl = getBackendUrl();
  if (!backendUrl || !state.currentLocation) {
    refs.locationChip.textContent = state.currentLocation
      ? `${state.currentLocation.lat.toFixed(4)}, ${state.currentLocation.lng.toFixed(4)}`
      : "Location unavailable";
    return;
  }
  if (!force && Date.now() - state.lastGeocodeAt < LOCATION_GEOCODE_THROTTLE_MS) {
    return;
  }

  state.lastGeocodeAt = Date.now();
  try {
    const data = await fetchJson(
      `${backendUrl}/reverse_geocode?lat=${state.currentLocation.lat}&lng=${state.currentLocation.lng}`
    );
    state.locationName = data.place_name || "Near you";
    refs.locationChip.textContent = state.locationName;
    maybePushLocationContext();
  } catch {
    refs.locationChip.textContent = `${state.currentLocation.lat.toFixed(4)}, ${state.currentLocation.lng.toFixed(4)}`;
  }
}

async function refreshNearby(force = false) {
  const backendUrl = getBackendUrl();
  if (!backendUrl || !state.currentLocation || state.mode !== "explorer") {
    return;
  }
  if (!force && Date.now() - state.lastNearbyAt < NEARBY_REFRESH_MS) {
    return;
  }

  state.lastNearbyAt = Date.now();
  refs.nearbyMeta.textContent = "Loading nearby places…";
  try {
    const data = await fetchJson(
      `${backendUrl}/nearby?lat=${state.currentLocation.lat}&lng=${state.currentLocation.lng}`
    );
    state.nearby = data;
    refs.nearbyMeta.textContent = "From backend";
    renderNearby();
    renderExplorerPanel();
    maybePushNearbyContext();
  } catch (error) {
    refs.nearbyMeta.textContent = "Nearby lookup failed";
    console.error(error);
  }
}

async function loadSessionContext() {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return;
  }
  try {
    const data = await fetchJson(`${backendUrl}/session-context/${state.sessionId}`);
    if (!state.homeAddress && data.home_address) {
      state.homeAddress = data.home_address;
      refs.homeAddressInput.value = data.home_address;
      window.localStorage.setItem(STORAGE_KEYS.homeAddress, data.home_address);
    }
    if (!state.preferences && data.preferences) {
      state.preferences = data.preferences;
      refs.preferencesInput.value = data.preferences;
      window.localStorage.setItem(STORAGE_KEYS.preferences, data.preferences);
    }
  } catch {}
}

function scheduleSessionContextSave() {
  window.localStorage.setItem(STORAGE_KEYS.homeAddress, state.homeAddress);
  window.localStorage.setItem(STORAGE_KEYS.preferences, state.preferences);
  if (state.pendingContextSaveTimer) {
    clearTimeout(state.pendingContextSaveTimer);
  }
  state.pendingContextSaveTimer = setTimeout(async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      return;
    }
    try {
      await fetchJson(`${backendUrl}/session-context/${state.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_address: state.homeAddress.trim(),
          preferences: state.preferences.trim(),
        }),
      });
    } catch {}
  }, 500);
}

function extractDirection(text) {
  const lower = text.toLowerCase();
  if (/\b(turn |go |head )?left\b/.test(lower)) {
    return { arrow: "←", label: "Turn left" };
  }
  if (/\b(turn |go |head )?right\b/.test(lower)) {
    return { arrow: "→", label: "Turn right" };
  }
  if (/\b(straight|ahead|forward)\b/.test(lower)) {
    return { arrow: "↑", label: "Go straight" };
  }
  return null;
}

function renderDirection() {
  const direction = state.latestDirection;
  if (
    !direction ||
    !(state.active && (state.mode === "vision" || state.mode === "memory"))
  ) {
    refs.directionPill.classList.add("hidden");
    return;
  }
  refs.directionArrow.textContent = direction.arrow;
  refs.directionText.textContent = direction.label;
  refs.directionPill.classList.remove("hidden");
}

function renderNearby() {
  const active = state.active && state.mode === "explorer";
  refs.nearbyRail.classList.toggle("hidden", !active);
  refs.explorerSidebar.classList.toggle("hidden", !active);
  refs.explorerPanel.classList.toggle("hidden", !active);

  if (!state.nearby || !active) {
    refs.nearbyGroups.innerHTML = `
      <div class="emptyState">Nearby place cards will appear here after location is available.</div>
    `;
    return;
  }

  refs.nearbyGroups.innerHTML = EXPLORER_CATEGORIES.map((item) => {
    const spots = state.nearby[item.key] || [];
    return `
      <section class="nearbyGroup">
        <div class="nearbyGroupHeader">
          <span>${item.emoji} ${item.label}</span>
          <small>${spots.length ? `${spots.length} picks` : "None"}</small>
        </div>
        <div class="spotList">
          ${
            spots.length
              ? spots
                  .map(
                    (spot, index) => `
                    <button class="spotCard" data-spot-category="${item.key}" data-spot-index="${index}" type="button">
                      <strong>${escapeHtml(spot.name)}</strong>
                      <span>${escapeHtml(spot.address || "Nearby")}</span>
                      <small>${escapeHtml(spot.walk || spot.open || "")}</small>
                    </button>
                  `
                  )
                  .join("")
              : `<div class="spotEmpty">No spots loaded yet.</div>`
          }
        </div>
      </section>
    `;
  }).join("");
}

function renderExplorerPanel() {
  if (!(state.active && state.mode === "explorer")) {
    refs.explorerPanel.classList.add("hidden");
    return;
  }

  const category = EXPLORER_CATEGORIES.find((item) => item.key === state.activeExplorerCategory);
  const spots = state.nearby?.[state.activeExplorerCategory] || [];
  refs.explorerPanelTitle.textContent = category?.label || "Nearby";
  refs.explorerPanelMeta.textContent = spots.length
    ? `${spots.length} backend results`
    : "Waiting for nearby data";

  refs.explorerPanelList.innerHTML = spots.length
    ? spots
        .map(
          (spot, index) => `
            <button class="panelSpot" data-spot-category="${state.activeExplorerCategory}" data-spot-index="${index}" type="button">
              <div class="panelSpotHeader">
                <strong>${escapeHtml(spot.name)}</strong>
                <span>${escapeHtml(spot.rating || "?")} ★</span>
              </div>
              <p>${escapeHtml(spot.address || "Nearby")}</p>
              <small>${escapeHtml(spot.walk || spot.open || "Tap for directions")}</small>
            </button>
          `
        )
        .join("")
    : `<div class="emptyState">No places yet. Share location and backend URL for explorer mode.</div>`;

  for (const button of refs.explorerSidebar.querySelectorAll(".explorerButton")) {
    button.classList.toggle(
      "selected",
      button.dataset.category === state.activeExplorerCategory
    );
  }
}

async function captureCurrentFrame() {
  if (!refs.previewEl.videoWidth || !refs.previewEl.videoHeight) {
    return null;
  }
  const context = refs.canvasEl.getContext("2d", { willReadFrequently: false });
  context.drawImage(refs.previewEl, 0, 0, refs.canvasEl.width, refs.canvasEl.height);
  const dataUrl = refs.canvasEl.toDataURL("image/jpeg", 0.72);
  return dataUrl.split(",", 2)[1];
}

async function sendVideoFrame() {
  if (!state.session || !refs.previewEl.videoWidth || !refs.previewEl.videoHeight) {
    return;
  }

  const base64 = await captureCurrentFrame();
  if (!base64) {
    return;
  }

  state.session.sendRealtimeInput({
    video: {
      data: base64,
      mimeType: "image/jpeg",
    },
  });
}

async function startAudioStreaming(stream) {
  state.inputAudioContext = new AudioContext();
  if (state.inputAudioContext.state !== "running") {
    await state.inputAudioContext.resume();
  }

  state.inputSourceNode = state.inputAudioContext.createMediaStreamSource(stream);
  state.inputProcessorNode = state.inputAudioContext.createScriptProcessor(4096, 1, 1);
  state.inputSilenceNode = state.inputAudioContext.createGain();
  state.inputSilenceNode.gain.value = 0;

  state.inputProcessorNode.onaudioprocess = (event) => {
    if (!state.session || state.muted) {
      return;
    }

    const inputData = event.inputBuffer.getChannelData(0);
    const downsampled = downsampleBuffer(
      inputData,
      state.inputAudioContext.sampleRate,
      INPUT_SAMPLE_RATE
    );
    const pcm16 = floatTo16BitPcm(downsampled);
    const base64 = bytesToBase64(new Uint8Array(pcm16.buffer));

    state.session.sendRealtimeInput({
      audio: {
        data: base64,
        mimeType: "audio/pcm;rate=16000",
      },
    });
  };

  state.inputSourceNode.connect(state.inputProcessorNode);
  state.inputProcessorNode.connect(state.inputSilenceNode);
  state.inputSilenceNode.connect(state.inputAudioContext.destination);
}

async function startLocationTracking() {
  if (!("geolocation" in navigator)) {
    appendTranscript("system", "Geolocation is not available in this browser.");
    return;
  }

  const handlePosition = async (position) => {
    const { latitude, longitude } = position.coords;
    const nextLocation = { lat: latitude, lng: longitude };
    const movedEnough =
      !state.currentLocation ||
      distanceMeters(
        state.currentLocation.lat,
        state.currentLocation.lng,
        nextLocation.lat,
        nextLocation.lng
      ) > MIN_MOVE_METERS;

    state.currentLocation = nextLocation;
    if (!state.locationName) {
      refs.locationChip.textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    if (movedEnough) {
      await refreshLocationName(true);
      await refreshNearby(true);
      maybePushLocationContext();
    } else {
      await refreshLocationName(false);
      await refreshNearby(false);
    }
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      handlePosition(position).catch(console.error);
    },
    (error) => {
      appendTranscript("system", `Location unavailable: ${error.message}`);
      refs.locationChip.textContent = "Location unavailable";
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );

  state.geoWatchId = navigator.geolocation.watchPosition(
    (position) => {
      handlePosition(position).catch(console.error);
    },
    (error) => {
      console.warn(error);
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
  );
}

function stopLocationTracking() {
  if (state.geoWatchId !== null) {
    navigator.geolocation.clearWatch(state.geoWatchId);
    state.geoWatchId = null;
  }
}

function startMemoryReminder() {
  stopMemoryReminder();
  if (state.mode !== "memory" || !state.active) {
    return;
  }

  const showReminder = () => {
    state.memoryReminderVisible = true;
    refs.memoryPill.classList.remove("hidden");
    if (state.memoryReminderHideTimer) {
      clearTimeout(state.memoryReminderHideTimer);
    }
    state.memoryReminderHideTimer = setTimeout(() => {
      state.memoryReminderVisible = false;
      refs.memoryPill.classList.add("hidden");
    }, 4000);
  };

  state.memoryReminderTimer = setInterval(showReminder, 28000);
  state.memoryReminderHideTimer = setTimeout(showReminder, 8000);
}

function stopMemoryReminder() {
  if (state.memoryReminderTimer) {
    clearInterval(state.memoryReminderTimer);
    state.memoryReminderTimer = null;
  }
  if (state.memoryReminderHideTimer) {
    clearTimeout(state.memoryReminderHideTimer);
    state.memoryReminderHideTimer = null;
  }
  state.memoryReminderVisible = false;
  refs.memoryPill.classList.add("hidden");
}

function handleLiveMessage(message) {
  const serverContent = message.serverContent;
  if (!serverContent) {
    return;
  }

  if (serverContent.interrupted) {
    stopPlayback();
  }

  if (serverContent.inputTranscription?.text) {
    state.heardText = serverContent.inputTranscription.text;
    refs.heardTextEl.textContent = state.heardText;
  }

  if (serverContent.outputTranscription?.text) {
    state.answerText = serverContent.outputTranscription.text;
    refs.answerTextEl.textContent = state.answerText;
    state.latestDirection = extractDirection(state.answerText);
    renderDirection();
  }

  if (serverContent.modelTurn?.parts) {
    for (const part of serverContent.modelTurn.parts) {
      if (part.inlineData?.data) {
        playPcmChunk(part.inlineData.data).catch((error) => {
          console.error("Audio playback failed", error);
          setStatus("Audio playback failed", "bad");
        });
      }
      if (part.text) {
        state.answerText = part.text;
        refs.answerTextEl.textContent = part.text;
        state.latestDirection = extractDirection(part.text);
        renderDirection();
      }
    }
  }

  if (serverContent.turnComplete && state.answerText && state.answerText !== state.lastAssistantLine) {
    state.lastAssistantLine = state.answerText;
    appendTranscript("assistant", state.answerText);
  }
}

async function stopLive() {
  if (state.isStopping) {
    return;
  }
  state.isStopping = true;

  stopMemoryReminder();
  stopLocationTracking();

  if (state.frameTimer) {
    clearInterval(state.frameTimer);
    state.frameTimer = null;
  }

  if (state.session) {
    try {
      state.session.sendRealtimeInput({ audioStreamEnd: true });
    } catch {}
    try {
      state.session.close();
    } catch {}
    state.session = null;
  }

  stopPlayback();

  if (state.inputProcessorNode) {
    state.inputProcessorNode.disconnect();
    state.inputProcessorNode.onaudioprocess = null;
    state.inputProcessorNode = null;
  }
  if (state.inputSourceNode) {
    state.inputSourceNode.disconnect();
    state.inputSourceNode = null;
  }
  if (state.inputSilenceNode) {
    state.inputSilenceNode.disconnect();
    state.inputSilenceNode = null;
  }
  if (state.inputAudioContext) {
    await state.inputAudioContext.close();
    state.inputAudioContext = null;
  }
  if (state.outputAudioContext) {
    await state.outputAudioContext.close();
    state.outputAudioContext = null;
    state.outputPlaybackTime = 0;
  }

  if (state.mediaStream) {
    for (const track of state.mediaStream.getTracks()) {
      track.stop();
    }
    state.mediaStream = null;
  }

  refs.previewEl.srcObject = null;
  state.active = false;
  state.connected = false;
  refs.startBtn.disabled = false;
  refs.stopBtn.disabled = true;
  setStatus("Stopped", "neutral");
  updateModeUI();
  state.isStopping = false;
}

async function startLive() {
  const apiKey = refs.apiKeyInput.value.trim();
  if (!apiKey) {
    setStatus("Paste a Gemini API key first", "bad");
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
  window.localStorage.setItem(STORAGE_KEYS.backendUrl, normalizeBackendUrl(refs.backendUrlInput.value));
  await pingBackend();
  await loadSessionContext();

  refs.startBtn.disabled = true;
  refs.stopBtn.disabled = false;
  state.transcript = [];
  renderTranscript();
  state.heardText = "-";
  state.answerText = "-";
  refs.heardTextEl.textContent = state.heardText;
  refs.answerTextEl.textContent = state.answerText;
  state.lastAssistantLine = "";
  state.lastPushedLocationKey = "";
  state.lastPushedNearbyKey = "";
  state.latestDirection = null;
  renderDirection();
  setStatus("Requesting camera and microphone…", "neutral");

  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: FRAME_WIDTH },
        height: { ideal: FRAME_HEIGHT },
      },
    });

    refs.previewEl.srcObject = state.mediaStream;
    await refs.previewEl.play();

    state.ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });

    state.session = await state.ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede",
            },
          },
        },
        systemInstruction: buildSystemInstruction(),
      },
      callbacks: {
        onopen: () => {
          state.active = true;
          state.connected = true;
          setStatus("Connected", "good");
          updateModeUI();
          appendTranscript("system", `${getCurrentModeConfig().label} mode live.`);
          maybePushLocationContext();
          maybePushNearbyContext();
          if (state.homeAddress.trim()) {
            sendSilentContext(`Saved home address: ${state.homeAddress.trim()}.`);
          }
          if (state.preferences.trim()) {
            sendSilentContext(`User preferences: ${state.preferences.trim()}.`);
          }
        },
        onmessage: handleLiveMessage,
        onerror: (error) => {
          console.error("Gemini Live error", error);
          setStatus(`Live error: ${error.message || "Unknown error"}`, "bad");
        },
        onclose: (event) => {
          console.log("Gemini Live closed", event);
          if (!state.isStopping) {
            setStatus(`Session closed: ${event.reason || "closed"}`, "bad");
            stopLive().catch((error) => console.error(error));
          }
        },
      },
    });

    await startAudioStreaming(state.mediaStream);
    await startLocationTracking();
    await sendVideoFrame();
    state.frameTimer = setInterval(() => {
      sendVideoFrame().catch((error) => console.error("Video frame send failed", error));
    }, FRAME_INTERVAL_MS);
    startMemoryReminder();
  } catch (error) {
    console.error(error);
    await stopLive();
    setStatus(error.message || "Failed to start live session", "bad");
  }
}

async function handleModeChange(nextMode) {
  if (!MODES[nextMode] || nextMode === state.mode) {
    return;
  }
  state.mode = nextMode;
  updateModeUI();
  startMemoryReminder();

  if (state.active) {
    appendTranscript("system", `Switching to ${MODES[nextMode].label} mode.`);
    await stopLive();
    await startLive();
  }
}

async function handleCapture() {
  if (!state.active) {
    setStatus("Start a live session first", "bad");
    return;
  }

  const base64 = await captureCurrentFrame();
  if (!base64) {
    setStatus("Camera frame is not ready", "bad");
    return;
  }

  const backendUrl = getBackendUrl();
  if (backendUrl) {
    try {
      await fetchJson(`${backendUrl}/capture/${state.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });
      appendTranscript("system", "Capture saved to backend.");
    } catch {
      appendTranscript("system", "Capture saved locally only; backend save failed.");
    }
  } else {
    appendTranscript("system", "Capture created locally.");
  }

  sendPrompt("Describe and save what you see right now.");
}

async function fetchDirections(destination) {
  const backendUrl = getBackendUrl();
  if (!backendUrl || !state.currentLocation) {
    return "";
  }
  try {
    const data = await fetchJson(
      `${backendUrl}/directions?origin_lat=${state.currentLocation.lat}&origin_lng=${state.currentLocation.lng}&destination=${encodeURIComponent(
        destination
      )}&mode=walking`
    );
    return data.directions || "";
  } catch {
    return "";
  }
}

async function handleTakeMeHome() {
  if (!state.active) {
    setStatus("Start a live session first", "bad");
    return;
  }
  if (!state.homeAddress.trim()) {
    setStatus("Add a home address first", "bad");
    refs.homeAddressInput.focus();
    return;
  }

  const directions = await fetchDirections(state.homeAddress.trim());
  if (directions) {
    sendSilentContext(`Route home context: ${directions}`);
  }
  sendPrompt("Take me home. Give one calm step at a time and wait between steps.");
}

async function handleSpotSelection(category, index) {
  const spot = state.nearby?.[category]?.[Number(index)];
  if (!spot) {
    return;
  }
  const directions = await fetchDirections(spot.address || spot.name);
  if (directions) {
    sendSilentContext(`Directions context for ${spot.name}: ${directions}`);
  }
  sendPrompt(`Guide me to ${spot.name}. Use short walking directions and landmarks.`);
}

function handleExplorerCategory(category) {
  state.activeExplorerCategory = category;
  renderExplorerPanel();
  const spots = state.nearby?.[category] || [];
  if (spots.length) {
    sendSilentContext(
      `${category} places near the user: ${spots
        .map((spot) => `${spot.name} (${spot.walk || spot.address || "nearby"})`)
        .join(", ")}`
    );
  }
}

function bindEvents() {
  refs.startBtn.addEventListener("click", () => {
    startLive();
  });
  refs.stopBtn.addEventListener("click", () => {
    stopLive();
  });

  refs.muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    refs.muteBtn.textContent = state.muted ? "Unmute" : "Mute";
    appendTranscript("system", state.muted ? "Microphone muted." : "Microphone unmuted.");
  });

  refs.captureBtn.addEventListener("click", () => {
    handleCapture().catch(console.error);
  });

  refs.homeBtn.addEventListener("click", () => {
    handleTakeMeHome().catch(console.error);
  });

  refs.modeGrid.addEventListener("click", (event) => {
    const target = event.target.closest(".modeCard");
    if (!target) {
      return;
    }
    handleModeChange(target.dataset.mode).catch(console.error);
  });

  refs.explorerSidebar.addEventListener("click", (event) => {
    const target = event.target.closest(".explorerButton");
    if (!target) {
      return;
    }
    handleExplorerCategory(target.dataset.category);
  });

  const handleSpotClick = (event) => {
    const target = event.target.closest("[data-spot-category][data-spot-index]");
    if (!target) {
      return;
    }
    handleSpotSelection(target.dataset.spotCategory, target.dataset.spotIndex).catch(
      console.error
    );
  };

  refs.explorerPanel.addEventListener("click", handleSpotClick);
  refs.nearbyRail.addEventListener("click", handleSpotClick);

  refs.apiKeyInput.addEventListener("input", () => {
    window.localStorage.setItem(STORAGE_KEYS.apiKey, refs.apiKeyInput.value.trim());
  });

  refs.backendUrlInput.addEventListener("input", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.backendUrl,
      normalizeBackendUrl(refs.backendUrlInput.value)
    );
  });
  refs.backendUrlInput.addEventListener("blur", () => {
    pingBackend().catch(console.error);
    loadSessionContext().catch(console.error);
  });

  refs.homeAddressInput.addEventListener("input", () => {
    state.homeAddress = refs.homeAddressInput.value;
    scheduleSessionContextSave();
  });

  refs.preferencesInput.addEventListener("input", () => {
    state.preferences = refs.preferencesInput.value;
    scheduleSessionContextSave();
  });

  window.addEventListener("beforeunload", () => {
    stopPlayback();
    if (state.mediaStream) {
      for (const track of state.mediaStream.getTracks()) {
        track.stop();
      }
    }
    if (state.session) {
      try {
        state.session.close();
      } catch {}
    }
  });
}

async function initialize() {
  refs.sessionIdLabel.textContent = state.sessionId.slice(0, 8);
  refs.locationChip.textContent = "Location unavailable";
  refs.heardTextEl.textContent = state.heardText;
  refs.answerTextEl.textContent = state.answerText;
  refs.muteBtn.textContent = "Mute";
  bindEvents();
  updateModeUI();
  await pingBackend();
  await loadSessionContext();
  renderNearby();
  renderExplorerPanel();
  renderTranscript();
}

initialize().catch(console.error);
