import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { Colors } from "../constants/colors";

interface TranscriptLine {
  text: string;
  isToolStatus: boolean;
}

interface TranscriptOverlayProps {
  lines: TranscriptLine[];
}

export default function TranscriptOverlay({ lines }: TranscriptOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState<TranscriptLine | null>(null);

  const latest = lines.length > 0 ? lines[lines.length - 1] : null;

  useEffect(() => {
    if (!latest) return;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setDisplayed(latest);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  }, [latest?.text]);

  // Pulsing dots animation for tool status
  useEffect(() => {
    if (displayed?.isToolStatus) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [displayed?.isToolStatus]);

  if (!displayed) return null;

  return (
    <View style={styles.wrapper}>
      <BlurView intensity={60} tint="dark" style={styles.blur}>
        <View style={styles.topBorder} />
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {displayed.isToolStatus ? (
            <View style={styles.toolRow}>
              <Animated.Text style={[styles.dot, { opacity: dotAnim }]}>●</Animated.Text>
              <Text style={styles.toolText} numberOfLines={2}>
                {displayed.text}
              </Text>
            </View>
          ) : (
            <Text style={styles.text} numberOfLines={3}>
              {displayed.text}
            </Text>
          )}
        </Animated.View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  blur: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 44,
  },
  topBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.border,
  },
  content: {
    alignItems: "center",
  },
  text: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 28,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    color: "#4CAF50",
    fontSize: 10,
  },
  toolText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
});
