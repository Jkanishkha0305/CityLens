import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { Colors } from "../constants/colors";

interface WaveformVisualizerProps {
  active: boolean;
}

const BAR_COUNT = 5;
const BAR_WIDTH = 4;
const BAR_GAP = 5;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 28;
const DURATIONS = [500, 700, 400, 600, 550];

export default function WaveformVisualizer({ active }: WaveformVisualizerProps) {
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_HEIGHT))
  ).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // Start each bar bouncing at its own speed
      loops.current = barAnims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: MAX_HEIGHT,
              duration: DURATIONS[i],
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: MIN_HEIGHT,
              duration: DURATIONS[i],
              useNativeDriver: false,
            }),
          ])
        );
        // Stagger start
        setTimeout(() => loop.start(), i * 100);
        return loop;
      });
    } else {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      loops.current.forEach((l) => l.stop());
      barAnims.forEach((a) => a.setValue(MIN_HEIGHT));
    }

    return () => {
      loops.current.forEach((l) => l.stop());
    };
  }, [active]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {barAnims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            { height: anim, marginHorizontal: BAR_GAP / 2 },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: MAX_HEIGHT,
    marginBottom: 20,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },
});
