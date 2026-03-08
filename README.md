# CityLens 🏙️

> A live AI city companion — point your phone at the world and it narrates back.

Built for the [Google Gemini Live Agent Challenge](https://devpost.com/) and Columbia Business School Hackathon (March 8, 2026).

---

## What it does

- **Sees** continuously through your phone camera — identifies landmarks, restaurants, signs
- **Listens** to your voice in real time and responds naturally
- **Speaks proactively** — tells you things before you ask ("That's Riverside Church, built in 1930...")
- **Finds places** — "any good food nearby under $20?" → real Google Maps results, spoken back
- **Guides home** — calm, step-by-step navigation for users who are lost or confused
- **Designed for accessibility** — dementia, visual impairment, solo travellers

---

## Architecture

```
Phone (React Native / Expo)
  ├── Camera frames (JPEG, every 2s) ──┐
  ├── Mic audio (PCM 16kHz) ───────────┤  WebSocket /ws/{session_id}
  ├── GPS coordinates ─────────────────┤
  └── Voice commands ─────────────────┘
                                        │
FastAPI Backend (Python)                │
  └── ADK Runner + LiveRequestQueue ◄──┘
        └── Orchestrator Agent (Gemini 2.5 Flash Native Audio)
              └── Google Maps MCP (npx @modelcontextprotocol/server-google-maps)

Phone ◄── Audio (PCM 24kHz) + Transcript overlay
```

**Stack:**
- AI: `gemini-2.5-flash-native-audio-latest` via Google ADK (multi-agent, live streaming)
- Maps: Google Maps MCP server (`@modelcontextprotocol/server-google-maps`)
- Backend: FastAPI + WebSocket, Python 3.11
- Mobile: React Native (Expo SDK 54), `expo-camera`, `expo-av`, `expo-location`
- Deploy: Google Cloud Run (Docker)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11 (not 3.12+) | `brew install python@3.11` or [python.org](https://python.org) |
| Node.js | 18+ | `brew install node` |
| uv | latest | `curl -Ls https://astral.sh/uv/install.sh \| sh` |
| Expo Go | 54.x | App Store / Play Store |
| npx | bundled with Node | — |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your keys:

```env
GEMINI_API_KEY=              # From https://aistudio.google.com/app/apikey
GOOGLE_API_KEY=              # Same value as GEMINI_API_KEY (ADK uses this name)
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_MAPS_API_KEY=         # From Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLOUD_PROJECT=citylens-hackathon
FIRESTORE_COLLECTION=citylens_sessions
VERTEX_AI_REGION=us-central1
PORT=8080
```

**Getting the keys:**
1. **Gemini API key** → [aistudio.google.com](https://aistudio.google.com/app/apikey) → Create API key
2. **Google Maps API key** → [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create API key
   - Enable: Maps JavaScript API, Places API, Directions API, Geocoding API

---

## Backend Setup

```bash
cd backend

# Create Python 3.11 virtual environment
uv venv .venv --python 3.11
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# IMPORTANT: Patch ADK to use v1beta (required for Gemini Live on AI Studio keys)
python -c "
import site, os
for d in site.getsitepackages():
    f = os.path.join(d, 'google/adk/models/google_llm.py')
    if os.path.exists(f):
        txt = open(f).read()
        patched = txt.replace(\"return 'v1alpha'\", \"return 'v1beta'\")
        open(f, 'w').write(patched)
        print('Patched:', f)
        break
"

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify it's running:
```bash
curl http://localhost:8000/
# → {"status": "ok", "service": "CityLens API"}
```

---

## Mobile Setup

```bash
cd mobile

# Install dependencies
npm install --legacy-peer-deps

# Set your backend IP
# Edit mobile/constants/config.ts:
#   WS_URL = "ws://<YOUR_MAC_IP>:8000/ws"
# Find your IP: ifconfig | grep "inet " | grep -v 127.0.0.1
```

Start Metro:
```bash
npx expo start
```

Scan the QR code with **Expo Go 54.x** on your phone. Make sure your phone and Mac are on the **same Wi-Fi network**.

---

## How to Test

### 1. Basic voice round-trip
- Start backend → start app → tap the big button
- Say "hello" → you should hear a voice response within 2-3 seconds

### 2. Camera narration
- Point camera at a landmark or sign
- Wait 5-10 seconds — the agent should proactively describe what it sees

### 3. Maps query
- Ask: "Is there any coffee nearby?"
- You'll see "Checking Maps..." in the transcript overlay while it searches
- Then hear 2-3 spoken results

### 4. Guide home
- Say: "Take me home"
- Agent will ask for your home address (once) then give step-by-step directions

### 5. GPS context
- Walk around — GPS updates are sent automatically every 30s
- The agent uses your real location for Maps queries

---

## Demo Script (Columbia Hackathon)

```
[0:00]  Open app → tap Start CityLens

[0:10]  Walk toward window / step outside

[0:20]  Agent: "I can see [landmark] — [one interesting fact]"
        (nobody asked — it just knew)

[0:40]  Ask: "Any good food nearby, under $20, nothing touristy?"
        Agent: "Let me check..." → 2-3 real options spoken

[1:10]  Say: "Capture this"
        Agent: "Saved — tagged as [location], [time]"

[1:30]  Say: "Take me home"
        Agent (calm): "Of course. Turn left out of the building..."

[2:00]  Explain to judges: "For someone with early dementia who
        walked out and forgot the way — this isn't a feature. It's a lifeline."
```

---

## Project Structure

```
CityLens/
├── backend/
│   ├── main.py                   # FastAPI app + WebSocket endpoint
│   ├── agents/
│   │   └── orchestrator.py       # Root ADK agent with Maps MCP tools
│   ├── services/
│   │   ├── firestore.py          # Trip memory (Firestore)
│   │   └── veo.py                # Veo journal reel (Vertex AI)
│   ├── Dockerfile                # Cloud Run container
│   ├── requirements.txt
│   └── .env.example
└── mobile/
    ├── screens/
    │   └── CityLensScreen.tsx    # Main screen
    ├── components/
    │   ├── BigButton.tsx         # Single tap to start
    │   ├── TranscriptOverlay.tsx # Live transcript + tool status
    │   ├── WaveformVisualizer.tsx
    │   └── StatusBar.tsx
    ├── services/
    │   ├── websocket.ts          # Bidirectional WS manager
    │   ├── audioCapture.ts       # PCM 16kHz mic recording
    │   ├── audioPlayback.ts      # PCM 24kHz speaker playback
    │   └── locationService.ts    # GPS updates
    └── constants/
        └── config.ts             # WS_URL — set this to your backend IP
```

---

## Deploy to Cloud Run

```bash
cd backend

# Build and push container
gcloud builds submit --tag gcr.io/citylens-hackathon/citylens-backend

# Deploy
gcloud run deploy citylens-backend \
  --image gcr.io/citylens-hackathon/citylens-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_API_KEY=<key>,GOOGLE_MAPS_API_KEY=<key>,GOOGLE_GENAI_USE_VERTEXAI=FALSE"
```

Then update `mobile/constants/config.ts`:
```typescript
export const WS_URL = "wss://your-cloud-run-url.run.app/ws";
```

---

## Known Issues

- **3-5 second Maps delay**: The Google Maps MCP server cold-starts a Node.js process per session. Normal behaviour.
- **iOS only for audio**: Android audio capture format needs a fix in `audioCapture.ts`.
- **Expo Go 54 required**: SDK 54 exactly. Don't update Expo Go to 55+ until the mobile project is upgraded.

---

## Team

Built at Columbia Business School Hackathon, March 8, 2026.

🤖 Powered by Gemini Live + Google ADK + Google Maps
