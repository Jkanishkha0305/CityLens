// Replace with your deployed Cloud Run URL or local IP for development
// Example local: "ws://192.168.1.x:8000/ws"
// Example Cloud Run: "wss://citylens-xxxxx-uc.a.run.app/ws"
export const WS_URL = "wss://citylens-backend-337689458575.us-central1.run.app/ws";

export const FRAME_INTERVAL_MS = 2000;   // Send camera frame every 2 seconds
export const GPS_INTERVAL_MS = 5000;     // Send GPS every 5 seconds
export const AUDIO_CHUNK_MS = 500;       // Record + send audio every 500ms (balance latency vs overhead)
export const WS_RECONNECT_DELAY_MS = 3000;
