import asyncio
import json
import os
import base64
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# ADK imports — verified against google/adk-python docs
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.genai import types

from agents.orchestrator import create_orchestrator
from services.firestore import get_session_context, save_session_context

load_dotenv()

app = FastAPI(title="CityLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_NAME = "citylens"
session_service = InMemorySessionService()


@app.get("/")
async def root():
    return {"status": "ok", "service": "CityLens API"}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    mode: str = Query(default="explorer"),
):
    await websocket.accept()
    print(f"[WS] Connected: {session_id}")

    # Load persisted context (home address, preferences) from Firestore
    ctx = await get_session_context(session_id)
    home_address = ctx.get("home_address", "")
    preferences = ctx.get("preferences", "")
    context_hint = ""
    if home_address:
        context_hint += f"\nUser's home address: {home_address}"
    if preferences:
        context_hint += f"\nUser preferences: {preferences}"

    # Create ADK session (ignore if already exists from a previous reconnect)
    try:
        await session_service.create_session(
            app_name=APP_NAME,
            user_id="user",
            session_id=session_id,
        )
    except Exception:
        pass  # Session already exists — reuse it

    print(f"[WS] Mode: {mode}")
    agent = create_orchestrator(mode=mode, context_hint=context_hint)
    runner = Runner(
        app_name=APP_NAME,
        agent=agent,
        session_service=session_service,
    )

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["audio"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Aoede"  # Warm, natural voice
                )
            )
        ),
    )

    live_request_queue = LiveRequestQueue()

    async def upstream():
        """Receive messages from React Native → forward to ADK."""
        try:
            while True:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "audio":
                    # PCM 16kHz audio from phone mic
                    audio_bytes = base64.b64decode(msg["data"])
                    live_request_queue.send_realtime(
                        types.Blob(
                            data=audio_bytes,
                            mime_type="audio/pcm;rate=16000",
                        )
                    )

                elif msg_type == "image":
                    # JPEG frame from camera (every 2s)
                    image_bytes = base64.b64decode(msg["data"])
                    live_request_queue.send_realtime(
                        types.Blob(
                            data=image_bytes,
                            mime_type="image/jpeg",
                        )
                    )

                elif msg_type == "gps":
                    # GPS update — injected as silent context
                    content = types.Content(
                        parts=[types.Part(
                            text=f"[GPS_UPDATE] lat={msg['lat']}, lng={msg['lng']}"
                        )],
                        role="user",
                    )
                    live_request_queue.send_content(content=content)

                elif msg_type == "text":
                    content = types.Content(
                        parts=[types.Part(text=msg["content"])],
                        role="user",
                    )
                    live_request_queue.send_content(content=content)

        except WebSocketDisconnect:
            print(f"[WS] Disconnected: {session_id}")
        except Exception as e:
            print(f"[WS] Upstream error: {e}")
        finally:
            live_request_queue.close()

    async def downstream():
        """Receive ADK events → forward to React Native."""
        try:
            async for event in runner.run_live(
                user_id="user",
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if not event.content or not event.content.parts:
                    continue

                for part in event.content.parts:
                    # Audio response → send to phone speaker
                    if part.inline_data and "audio" in part.inline_data.mime_type:
                        await websocket.send_text(json.dumps({
                            "type": "audio",
                            "data": base64.b64encode(part.inline_data.data).decode(),
                            "mime_type": part.inline_data.mime_type,
                        }))

                    # Text response → show as transcript
                    elif part.text:
                        await websocket.send_text(json.dumps({
                            "type": "transcript",
                            "content": part.text,
                        }))

                    # Tool call in progress → show as status on phone
                    elif part.function_call:
                        tool_name = getattr(part.function_call, "name", "maps")
                        tool_labels = {
                            "maps_search_places": "Searching nearby places...",
                            "maps_text_search": "Looking up places on Maps...",
                            "maps_place_details": "Getting place details...",
                            "maps_directions": "Getting directions...",
                            "maps_geocode": "Finding location...",
                        }
                        label = tool_labels.get(tool_name, "Checking Maps...")
                        print(f"[Tool] {tool_name} called")
                        await websocket.send_text(json.dumps({
                            "type": "tool_status",
                            "content": label,
                        }))

        except Exception as e:
            print(f"[WS] Downstream error: {e}")

    # Run both directions concurrently
    await asyncio.gather(upstream(), downstream(), return_exceptions=True)
    print(f"[WS] Session ended: {session_id}")
