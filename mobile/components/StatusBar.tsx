import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Colors } from "../constants/colors";

interface LiveStatusBarProps {
  connected: boolean;
  active: boolean;
  sessionStartTime: number | null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function LiveStatusBar({
  connected,
  active,
  sessionStartTime,
}: LiveStatusBarProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const blinkLoop = useRef<Animated.CompositeAnimation | null>(null);
  const [elapsed, setElapsed] = useState("00:00");

  // Blinking dot when active
  useEffect(() => {
    if (active && connected) {
      blinkLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      blinkLoop.current.start();
    } else {
      blinkLoop.current?.stop();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => blinkLoop.current?.stop();
  }, [active, connected]);

  // Session timer tick
  useEffect(() => {
    if (!active || !sessionStartTime) {
      setElapsed("00:00");
      return;
    }
    const interval = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - sessionStartTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, sessionStartTime]);

  const dotColor = active && connected ? Colors.accent : connected ? "#facc15" : "#6b7280";

  // When active: minimal — just dot + timer
  if (active) {
    return (
      <View style={styles.activeRow}>
        <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: fadeAnim }]} />
        <Text style={styles.timerText}>{elapsed}</Text>
      </View>
    );
  }

  // When idle: full pill with label
  const label = connected ? "Connected" : "Offline";

  return (
    <View style={styles.idlePill}>
      <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: fadeAnim }]} />
      <Text style={styles.idleLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
  idlePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 7,
  },
  idleLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
