import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, SafeAreaView, Platform, Animated } from "react-native";
import { CameraView } from "expo-camera";

import BigButton from "../components/BigButton";
import CameraViewComponent from "../components/CameraView";
import TranscriptOverlay from "../components/TranscriptOverlay";
import LiveStatusBar from "../components/StatusBar";
import WaveformVisualizer from "../components/WaveformVisualizer";
import QuickActions from "../components/QuickActions";

import { wsManager, WSMessage } from "../services/websocket";
import { startAudioCapture, stopAudioCapture } from "../services/audioCapture";
import { enqueueAudioChunk, startPlayback, stopPlayback } from "../services/audioPlayback";
import { startLocationService, stopLocationService } from "../services/locationService";
import { FRAME_INTERVAL_MS } from "../constants/config";
import { Colors } from "../constants/colors";

export default function CityLensScreen() {
  const [active, setActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<{ text: string; isToolStatus: boolean }[]>([]);

  const cameraRef = useRef<CameraView>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const isMutedRef = useRef(false);

  // Camera flash overlay for "Capture" action
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    wsManager.setHandlers(handleWSMessage, (isConnected) => {
      setConnected(isConnected);
    });
    return () => {
      stopAll();
    };
  }, []);

  // Keep ref in sync with state so the audio callback sees the latest value
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "audio") {
      enqueueAudioChunk(msg.data);
    } else if (msg.type === "transcript" || msg.type === "text") {
      setTranscriptLines((prev) =>
        [...prev, { text: msg.content, isToolStatus: false }].slice(-10)
      );
    } else if (msg.type === "tool_status") {
      setTranscriptLines((prev) =>
        [...prev, { text: msg.content, isToolStatus: true }].slice(-10)
      );
    }
  }, []);

  const startAll = useCallback(async () => {
    const now = Date.now();
    sessionStartTimeRef.current = now;
    setSessionStartTime(now);

    wsManager.connect();
    startPlayback();

    startAudioCapture((base64Audio) => {
      if (!isMutedRef.current) {
        wsManager.sendAudio(base64Audio);
      }
    });

    frameTimerRef.current = setInterval(async () => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.4,
          skipProcessing: true,
          exif: false,
        });
        if (photo?.base64) {
          wsManager.sendImage(photo.base64);
        }
      } catch {
        // Camera may not be ready — suppress
      }
    }, FRAME_INTERVAL_MS);

    startLocationService((lat, lng) => {
      wsManager.sendGPS(lat, lng);
    });
  }, []);

  const stopAll = useCallback(() => {
    stopAudioCapture();
    stopPlayback();
    stopLocationService();

    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }

    wsManager.disconnect();
    setTranscriptLines([]);
    setIsMuted(false);

    sessionStartTimeRef.current = null;
    setSessionStartTime(null);
  }, []);

  const handleButtonPress = useCallback(async () => {
    if (active) {
      setActive(false);
      stopAll();
    } else {
      setActive(true);
      await startAll();
    }
  }, [active, startAll, stopAll]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handleCapture = useCallback(() => {
    wsManager.sendText("Describe and save what you see right now.");

    // White flash effect
    flashOpacity.setValue(0.6);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [flashOpacity]);

  return (
    <View style={styles.root}>
      {/* Full-screen camera preview */}
      <CameraViewComponent ref={cameraRef} active={active} />

      {/* Dark overlay when idle */}
      {!active && <View style={styles.idleOverlay} />}

      {/* Camera flash for capture */}
      <Animated.View
        style={[styles.flash, { opacity: flashOpacity }]}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.ui}>
        {/* --- Top Bar --- */}
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <LiveStatusBar
            connected={connected}
            active={active}
            sessionStartTime={sessionStartTime}
          />
        </View>

        {/* --- Center: Waveform + Button --- */}
        <View style={styles.centerArea}>
          <WaveformVisualizer active={active && !isMuted} />
          <BigButton active={active} onPress={handleButtonPress} />
        </View>

        {/* --- Bottom: Quick Actions + Transcript --- */}
        {active && (
          <View style={styles.bottomArea}>
            <QuickActions
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              onCapture={handleCapture}
            />
          </View>
        )}

        {active && <TranscriptOverlay lines={transcriptLines} />}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  idleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
  },
  ui: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 16 : 4,
    marginTop: 4,
  },
  topBarSpacer: {
    flex: 1,
  },
  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 120,
  },
  bottomArea: {
    position: "absolute",
    bottom: 110,
    left: 0,
    right: 0,
  },
});
