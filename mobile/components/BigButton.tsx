import React, { useEffect, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, Animated, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/colors";

interface BigButtonProps {
  active: boolean;
  onPress: () => void;
}

const BUTTON_SIZE = 140;
const RING_EXPANSION = 30;

export default function BigButton({ active, onPress }: BigButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;

  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const ringLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      // Subtle breathe on the main button
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();

      // Two expanding rings, staggered
      ringLoop.current = Animated.loop(
        Animated.stagger(600, [
          Animated.parallel([
            Animated.timing(ring1Scale, { toValue: 1.5, duration: 1400, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(ring1Opacity, { toValue: 0.5, duration: 200, useNativeDriver: true }),
              Animated.timing(ring1Opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(ring2Scale, { toValue: 1.5, duration: 1400, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(ring2Opacity, { toValue: 0.5, duration: 200, useNativeDriver: true }),
              Animated.timing(ring2Opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ]),
          ]),
        ])
      );
      ringLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      ringLoop.current?.stop();

      Animated.parallel([
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(ring1Opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(ring2Opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        ring1Scale.setValue(1);
        ring2Scale.setValue(1);
      });
    }

    return () => {
      pulseLoop.current?.stop();
      ringLoop.current?.stop();
    };
  }, [active]);

  return (
    <View style={styles.wrapper}>
      {/* Expanding ring 1 */}
      <Animated.View
        style={[
          styles.ring,
          { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
        ]}
      />
      {/* Expanding ring 2 */}
      <Animated.View
        style={[
          styles.ring,
          { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
        ]}
      />

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[styles.button, active ? styles.buttonActive : styles.buttonIdle]}
          onPress={onPress}
          activeOpacity={0.75}
          accessibilityLabel={active ? "Stop CityLens" : "Start CityLens"}
          accessibilityRole="button"
        >
          <Feather
            name={active ? "square" : "mic"}
            size={active ? 30 : 36}
            color={active ? Colors.accent : Colors.background}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Caption below the button */}
      <Text style={[styles.caption, active && styles.captionActive]}>
        {active ? "Listening" : "Start CityLens"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: BUTTON_SIZE + RING_EXPANSION * 2,
    height: BUTTON_SIZE + RING_EXPANSION * 2 + 32,
  },
  ring: {
    position: "absolute",
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    top: RING_EXPANSION,
    left: RING_EXPANSION,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonIdle: {
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
  },
  buttonActive: {
    backgroundColor: "rgba(20,20,20,0.92)",
    borderWidth: 1.5,
    borderColor: Colors.accentDim,
    shadowColor: Colors.accent,
  },
  caption: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.textSecondary,
  },
  captionActive: {
    color: Colors.accent,
  },
});
