import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

interface QuickActionsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onCapture: () => void;
}

export default function QuickActions({
  isMuted,
  onToggleMute,
  onCapture,
}: QuickActionsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.actionButton, isMuted && styles.actionButtonMuted]}
        onPress={onToggleMute}
        activeOpacity={0.7}
        accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
        accessibilityRole="button"
      >
        <Feather
          name={isMuted ? "mic-off" : "mic"}
          size={22}
          color={isMuted ? Colors.danger : Colors.primary}
        />
        <Text style={[styles.actionLabel, isMuted && styles.actionLabelMuted]}>
          {isMuted ? "Muted" : "Mute"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onCapture}
        activeOpacity={0.7}
        accessibilityLabel="Capture this moment"
        accessibilityRole="button"
      >
        <Feather name="camera" size={22} color={Colors.primary} />
        <Text style={styles.actionLabel}>Capture</Text>
      </TouchableOpacity>
    </View>
  );
}

const ACTION_SIZE = 52;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    paddingBottom: 12,
  },
  actionButton: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    backgroundColor: Colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonMuted: {
    backgroundColor: "rgba(248,113,113,0.15)",
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 3,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  actionLabelMuted: {
    color: Colors.danger,
  },
});
