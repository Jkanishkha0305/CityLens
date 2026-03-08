import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Colors } from "../constants/colors";

export type AppMode = "explorer" | "vision" | "memory";

interface ModeCard {
  mode: AppMode;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
}

const MODES: ModeCard[] = [
  {
    mode: "explorer",
    emoji: "🧭",
    title: "Explorer",
    subtitle: "Traveller Mode",
    description:
      "Proactive narrations, nearby recommendations, Maps suggestions. Your curious local guide.",
    accentColor: "#6ee7b7",
  },
  {
    mode: "vision",
    emoji: "👁",
    title: "Vision Assist",
    subtitle: "Visually Impaired Mode",
    description:
      "Reads signs, menus, and labels aloud. Describes obstacles, steps, and spatial layout continuously.",
    accentColor: "#93c5fd",
  },
  {
    mode: "memory",
    emoji: "🏠",
    title: "Memory Companion",
    subtitle: "Dementia Support Mode",
    description:
      "Calm, step-by-step guidance home. Recognises familiar landmarks. Always reassuring, never overwhelming.",
    accentColor: "#fca5a5",
  },
];

interface Props {
  onSelect: (mode: AppMode) => void;
}

export default function ModeSelectScreen({ onSelect }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.logo}>CityLens</Text>
        <Text style={styles.tagline}>Who are you exploring for?</Text>
      </View>

      <View style={styles.cards}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.mode}
            style={[styles.card, { borderColor: m.accentColor + "40" }]}
            onPress={() => onSelect(m.mode)}
            activeOpacity={0.75}
            accessibilityLabel={`${m.title}: ${m.description}`}
            accessibilityRole="button"
          >
            <View style={styles.cardTop}>
              <Text style={styles.emoji}>{m.emoji}</Text>
              <View style={styles.cardTitles}>
                <Text style={[styles.cardTitle, { color: m.accentColor }]}>
                  {m.title}
                </Text>
                <Text style={styles.cardSubtitle}>{m.subtitle}</Text>
              </View>
            </View>
            <Text style={styles.cardDesc}>{m.description}</Text>
            <View style={[styles.cardBar, { backgroundColor: m.accentColor }]} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.footer}>Powered by Gemini Live + Google Maps</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: "center",
  },
  logo: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  cards: {
    flex: 1,
    gap: 16,
    justifyContent: "center",
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 14,
  },
  emoji: {
    fontSize: 32,
  },
  cardTitles: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  cardBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  footer: {
    textAlign: "center",
    color: "rgba(255,255,255,0.2)",
    fontSize: 12,
    paddingBottom: 16,
  },
});
