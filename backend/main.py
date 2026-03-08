import asyncio
import json
import os
import base64
import io
import binascii
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from services.firestore import get_session_context, save_capture, save_session_context
from services.maps import (
    search_nearby_places_structured,
    get_walking_duration,
    get_directions,
    reverse_geocode,
)
from agents.orchestrator import create_orchestrator

load_dotenv()

APP_NAME = "citylens"
session_service = InMemorySessionService()

# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="CityLens API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "CityLens API"}


class SessionContextPayload(BaseModel):
    home_address: str | None = None
    preferences: str | None = None


class CapturePayload(BaseModel):
    image_base64: str


# ── /nearby endpoint ──────────────────────────────────────────────────────────

def _spot_with_walk(place: dict, user_lat: float, user_lng: float) -> dict:
    """Return spot dict with name, address, rating, open, walk (no lat/lng)."""
    lat = place.get("lat")
    lng = place.get("lng")
    walk = ""
    if lat is not None and lng is not None:
        walk = get_walking_duration(user_lat, user_lng, float(lat), float(lng))
    return {
        "name": place.get("name", ""),
        "address": place.get("address", ""),
        "rating": place.get("rating", "?"),
        "open": place.get("open", ""),
        "walk": walk,
    }


@app.get("/nearby")
async def get_nearby(lat: float = Query(...), lng: float = Query(...)):
    food_raw, land_raw, evt_raw = await asyncio.gather(
        asyncio.to_thread(search_nearby_places_structured, "restaurants food cafes", lat, lng, 800),
        asyncio.to_thread(search_nearby_places_structured, "landmarks monuments tourist", lat, lng, 1000),
        asyncio.to_thread(search_nearby_places_structured, "entertainment events things to do", lat, lng, 800),
    )

    async def add_walks(places: list[dict]) -> list[dict]:
        if not places:
            return []
        return await asyncio.gather(
            *[asyncio.to_thread(_spot_with_walk, p, lat, lng) for p in places]
        )

    food_list, landmarks_list, events_list = await asyncio.gather(
        add_walks(food_raw),
        add_walks(land_raw),
        add_walks(evt_raw),
    )
    return {
        "food": list(food_list),
        "landmarks": list(landmarks_list),
        "events": list(events_list),
    }


@app.get("/reverse_geocode")
async def get_reverse_geocode(lat: float = Query(...), lng: float = Query(...)):
    place_name = await asyncio.to_thread(reverse_geocode, lat, lng)
    return {"place_name": place_name}


@app.get("/directions")
async def directions(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    destination: str = Query(...),
    mode: str = Query(default="walking"),
):
    route = await asyncio.to_thread(
        get_directions,
        origin_lat,
        origin_lng,
        destination,
        mode,
    )
    return {"directions": route}


@app.get("/session-context/{session_id}")
async def read_session_context(session_id: str):
    context = await get_session_context(session_id)
    return {
        "home_address": context.get("home_address", ""),
        "preferences": context.get("preferences", ""),
    }


@app.post("/session-context/{session_id}")
async def write_session_context(session_id: str, payload: SessionContextPayload):
    data = {
        key: value
        for key, value in payload.model_dump().items()
        if value
    }
    if data:
        await save_session_context(session_id, data)
    return {"status": "ok", "saved_keys": list(data.keys())}


@app.post("/capture/{session_id}")
async def create_capture(session_id: str, payload: CapturePayload):
    await save_capture(session_id, payload.image_base64)
    return {"status": "ok"}


def _decode_base64_payload(payload: str) -> bytes:
    """Decode mobile-sent base64 robustly.

    Accepts raw base64, URL-safe base64, and data URLs. Adds padding if the client
    omitted trailing '=' characters.
    """
    if not payload:
        raise ValueError("empty payload")

    normalized = payload.strip()
    if "," in normalized and normalized.split(",", 1)[0].startswith("data:"):
        normalized = normalized.split(",", 1)[1]
    normalized = "".join(normalized.split())
    normalized = normalized.replace("-", "+").replace("_", "/")

    padding = (-len(normalized)) % 4
    if padding:
        normalized += "=" * padding

    return base64.b64decode(normalized)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    mode: str = Query(default="explorer"),
):
    await websocket.accept()
    print(f"[WS] Connected: {session_id} mode={mode}")

    # Load Firestore context (non-blocking on failure)
    ctx = await get_session_context(session_id)
    context_hint = ""
    if ctx.get("home_address"):
        context_hint += f"\nUser's home address: {ctx['home_address']}"
    if ctx.get("preferences"):
        context_hint += f"\nUser preferences: {ctx['preferences']}"

    current_gps: dict = {}
    current_nearby_spots: dict = {}

    orchestrator = create_orchestrator(
        mode=mode,
        context_hint=context_hint,
        gps_store=current_gps,
        nearby_store=current_nearby_spots,
    )

    # Fix for 1007 error: delete stale ADK session (clears accumulated audio history)
    # then create a fresh one for every WebSocket connection
    try:
        await session_service.delete_session(app_name=APP_NAME, user_id="user", session_id=session_id)
    except Exception:
        pass
    await session_service.create_session(app_name=APP_NAME, user_id="user", session_id=session_id)

    runner = Runner(
        app_name=APP_NAME,
        agent=orchestrator,
        session_service=session_service,
    )

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    live_queue = LiveRequestQueue()

    async def upstream():
        """Phone → ADK LiveRequestQueue → Gemini Live"""
        try:
            while True:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                t = msg.get("type")

                try:
                    if t == "audio":
                        audio_bytes = _decode_base64_payload(msg["data"])
                        mime_type = msg.get("mime_type") or "audio/pcm;rate=16000"
                        live_queue.send_realtime(
                            types.Blob(data=audio_bytes, mime_type=mime_type)
                        )

                    elif t == "image":
                        img_bytes = _decode_base64_payload(msg["data"])
                        # Mobile sends JPEG from takePictureAsync — pass directly
                        live_queue.send_realtime(
                            types.Blob(data=img_bytes, mime_type="image/jpeg")
                        )

                    elif t == "gps":
                        current_gps["lat"] = msg["lat"]
                        current_gps["lng"] = msg["lng"]
                        print(f"[GPS] {msg['lat']:.4f}, {msg['lng']:.4f}")

                    elif t == "nearby_spots":
                        current_nearby_spots.clear()
                        for key in ("food", "landmarks", "events"):
                            if key in msg and isinstance(msg[key], list):
                                current_nearby_spots[key] = msg[key]

                    elif t == "text":
                        live_queue.send_content(
                            content=types.Content(
                                role="user",
                                parts=[types.Part(text=msg["content"])],
                            )
                        )

                except (KeyError, ValueError, binascii.Error) as e:
                    print(f"[WS] Skipping malformed {t or 'unknown'} packet: {e}")
                    continue

        except WebSocketDisconnect:
            print(f"[WS] Disconnected: {session_id}")
        except Exception as e:
            print(f"[WS] Upstream error: {e}")
        finally:
            live_queue.close()

    async def downstream():
        """ADK Runner (tool calls handled automatically) → Phone"""
        try:
            async for event in runner.run_live(
                user_id="user",
                session_id=session_id,
                live_request_queue=live_queue,
                run_config=run_config,
            ):
                # Audio chunks from model → phone speaker
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "inline_data") and part.inline_data:
                            await websocket.send_text(json.dumps({
                                "type": "audio",
                                "data": base64.b64encode(part.inline_data.data).decode(),
                                "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000",
                            }))
                        elif hasattr(part, "text") and part.text:
                            await websocket.send_text(json.dumps({
                                "type": "transcript",
                                "content": part.text,
                            }))

                # Output audio transcription → transcript overlay
                if event.output_transcription and event.output_transcription.text:
                    await websocket.send_text(json.dumps({
                        "type": "transcript",
                        "content": event.output_transcription.text,
                    }))

        except Exception as e:
            print(f"[WS] Downstream error: {e}")

    await asyncio.gather(upstream(), downstream(), return_exceptions=True)
    print(f"[WS] Session ended: {session_id}")
