import { WS_URL, WS_RECONNECT_DELAY_MS } from "../constants/config";
import { v4 as uuidv4 } from "uuid";

export type WSMessage =
  | { type: "audio"; data: string; mime_type: string }
  | { type: "transcript"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_status"; content: string };

type MessageHandler = (msg: WSMessage) => void;
type StatusHandler = (connected: boolean) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private messageQueue: string[] = [];
  private onMessage: MessageHandler | null = null;
  private onStatusChange: StatusHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private shouldReconnect = false;

  constructor() {
    this.sessionId = uuidv4();
  }

  setHandlers(onMessage: MessageHandler, onStatus: StatusHandler) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatus;
  }

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;
    this.isConnecting = true;

    const url = `${WS_URL}/${this.sessionId}`;
    console.log(`[WS] Connecting to ${url}`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.isConnecting = false;
      this.onStatusChange?.(true);
      // Flush any queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift();
        if (msg) this.ws?.send(msg);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.onMessage?.(msg);
      } catch (e) {
        console.warn("[WS] Failed to parse message:", e);
      }
    };

    this.ws.onerror = (error) => {
      console.warn("[WS] Error:", error);
      this.isConnecting = false;
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected");
      this.isConnecting = false;
      this.ws = null;
      this.onStatusChange?.(false);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) this.connect();
    }, WS_RECONNECT_DELAY_MS);
  }

  send(payload: object) {
    const msg = JSON.stringify(payload);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      // Queue up to 20 messages to avoid unbounded growth
      if (this.messageQueue.length < 20) {
        this.messageQueue.push(msg);
      }
    }
  }

  sendAudio(base64Data: string) {
    this.send({ type: "audio", data: base64Data, mime_type: "audio/pcm;rate=16000" });
  }

  sendImage(base64Data: string) {
    this.send({ type: "image", data: base64Data });
  }

  sendGPS(lat: number, lng: number) {
    this.send({ type: "gps", lat, lng });
  }

  sendText(content: string) {
    this.send({ type: "text", content });
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.messageQueue = [];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
