import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
} from "react-native";
import { Colors } from "../constants/colors";
import { AppMode } from "../screens/ModeSelectScreen";

interface ModeOption {
  mode: AppMode;
  emoji: string;
  title: string;
  subtitle: string;
  accentColor: string;
}

const MODES: ModeOption[] = [
  {
    mode: "explorer",
    emoji: "🧭",
    title: "Explorer",
    subtitle: "Proactive narration · Maps · Discoveries",
    accentColor: "#6ee7b7",
  },
  {
    mode: "vision",
    emoji: "👁",
    title: "Vision Assist",
    subtitle: "Reads signs · Describes space · Obstacle alerts",
    accentColor: "#93c5fd",
  },
  {
    mode: "memory",
    emoji: "🏠",
    title: "Memory Companion",
    subtitle: "Landmarks · Calm navigation · Always reassuring",
    accentColor: "#fca5a5",
  },
];

interface Props {
  visible: boolean;
  currentMode: AppMode;
  onSelect: (mode: AppMode) => void;
  onClose: () => void;
}

export default function ModeSwitcher({
  visible,
  currentMode,
  onSelect,
  onClose,
}: Props) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>Switch Mode</Text>

        {MODES.map((m) => {
          const isActive = m.mode === currentMode;
          return (
            <TouchableOpacity
              key={m.mode}
              style={[
                styles.row,
                isActive && { borderColor: m.accentColor + "80" },
              ]}
              onPress={() => onSelect(m.mode)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={m.title}
            >
              <View style={[styles.colorBar, { backgroundColor: m.accentColor }]} />
              <Text style={styles.emoji}>{m.emoji}</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, isActive && { color: m.accentColor }]}>
                  {m.title}
                </Text>
                <Text style={styles.rowSub}>{m.subtitle}</Text>
              </View>
              {isActive && (
                <View style={[styles.activeDot, { backgroundColor: m.accentColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginVertical: 5,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
    overflow: "hidden",
    gap: 12,
  },
  colorBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  emoji: {
    fontSize: 26,
    marginLeft: 8,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
