# CityLens

CityLens is a live multimodal assistant for people who need more support from the world around them.

Point a camera at the environment, speak naturally, and get a spoken answer back in real time.

## The Problem

A lot of everyday environments are built for people who can quickly interpret visual context:

- a traveler trying to understand where they are and what matters nearby
- a low-vision user trying to identify objects, read signs, or avoid hazards
- a person who is disoriented and needs calm, step-by-step help getting home

Standard maps apps and voice assistants help with narrow tasks, but they usually do not combine:

- live camera understanding
- live voice conversation
- location awareness
- nearby places and directions
- mode-specific guidance for different user needs

CityLens tries to solve that gap.

## What CityLens Does

CityLens combines Gemini Live with camera, microphone, and location input to create a real-time city companion.

It currently supports three interaction modes:

### Explorer

For solo travelers and curious users.

- understand what the camera is pointed at
- answer questions about landmarks, signs, buildings, and surroundings
- fetch nearby food, attractions, and events
- guide the user toward a selected place

### Vision

For low-vision assistance.

- describe what is in front of the user
- answer visual questions like “what is this?” or “what does this sign say?”
- give direct spoken responses from live camera context
- surface directional cues from the conversation when relevant

### Memory

For calm, supportive guidance.

- keep the tone gentle and step-by-step
- store a home address and preferences
- help guide the user home
- support a less overwhelming style of interaction

## Current State

There are two clients in this repo:

- `quick-live-web/`
  - the fastest working demo
  - direct browser connection to Gemini Live for camera + mic + spoken response
  - optional backend integration for location, nearby places, directions, session context, and captures
- `mobile/`
  - React Native / Expo prototype
  - useful as a product prototype, but the browser client is currently the most reliable live demo path

If you want to test the project quickly, use the web app.

## How It Works

### Live path

- browser opens camera + microphone
- browser streams live audio and video frames into Gemini Live
- Gemini Live returns spoken output and live transcription
- the app plays the audio back in the browser

### Backend path

The FastAPI backend adds app-specific context and utility endpoints:

- reverse geocoding
- nearby places
- walking directions
- session context storage
- capture saving

The web client uses direct Gemini Live for conversation, and the backend for city-specific features.

## Architecture

```text
Camera + Mic + Location
        |
        v
quick-live-web (Vite / JS)
  - direct Gemini Live session
  - mode switching
  - transcript + spoken playback
  - nearby place UI
        |
        +---------------------> Gemini Live API
        |
        +---------------------> FastAPI backend
                                  - /nearby
                                  - /reverse_geocode
                                  - /directions
                                  - /session-context
                                  - /capture
```

## Stack

- Frontend: Vite, vanilla JS, browser media APIs
- Mobile prototype: Expo / React Native
- Backend: FastAPI, Python 3.11
- AI: Gemini Live (`gemini-2.5-flash-native-audio-preview-12-2025`)
- Maps and location services: Google Maps Platform via backend services
- Persistence: Firestore hooks for session context and captures

## Run Locally

### 1. Start the backend

```bash
cd backend
uv run --env-file .env uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the web app

```bash
cd quick-live-web
npm install
npm run dev
```

### 3. Open the app

Open:

```text
http://localhost:5173
```

Then:

1. paste your Gemini API key
2. set `Backend URL` to `http://localhost:8000`
3. allow camera, microphone, and location
4. click `Start Live`

## Environment

Backend environment is driven by `backend/.env.example`.

Typical keys:

```env
GEMINI_API_KEY=
GOOGLE_API_KEY=
GOOGLE_MAPS_API_KEY=
GOOGLE_CLOUD_PROJECT=
FIRESTORE_COLLECTION=citylens_sessions
```

Notes:

- `GOOGLE_API_KEY` / `GEMINI_API_KEY` are used for Gemini access
- `GOOGLE_MAPS_API_KEY` is used for nearby places, directions, and reverse geocoding
- Firestore is optional for basic demo use, but session context endpoints expect cloud credentials if you want persistence

## Repo Layout

```text
CityLens/
├── backend/
│   ├── main.py
│   ├── agents/
│   └── services/
├── mobile/
│   ├── screens/
│   ├── services/
│   └── components/
└── quick-live-web/
    ├── src/main.js
    ├── src/style.css
    └── vite.config.js
```

## What Is Working Best Right Now

Best current demo flow:

- run the backend
- run `quick-live-web`
- point the camera at something
- ask a question like “what am I looking at?”
- hear the answer back
- use Explorer mode with location enabled for nearby places

## Known Limitations

- the browser demo is the most reliable live path right now
- the Expo mobile prototype still has more implementation risk around real-time native media streaming
- Firestore-backed persistence needs valid Google Cloud credentials
- local phone testing generally needs HTTPS or a tunnel for camera/mic permissions

## Why This Matters

CityLens is trying to make environmental understanding more accessible.

For one user, that means “what building is this?”

For another, it means “read that sign for me.”

For someone else, it means “please help me get home calmly.”

That is the product idea: one live assistant, different support modes, grounded in what the user sees, says, and where they are.
