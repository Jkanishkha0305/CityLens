import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";

import CityLensScreen from "./screens/CityLensScreen";
import ModeSelectScreen, { AppMode } from "./screens/ModeSelectScreen";
import { Colors } from "./constants/colors";

type PermissionState = "loading" | "granted" | "denied";

interface PermissionRowProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  state: PermissionState;
}

function PermissionRow({ label, icon, state }: PermissionRowProps) {
  return (
    <View style={styles.permRow}>
      <Feather name={icon} size={20} color={Colors.textSecondary} />
      <Text style={styles.permLabel}>{label}</Text>
      <View style={styles.permStatusBox}>
        {state === "loading" && (
          <Feather name="loader" size={16} color={Colors.textSecondary} />
        )}
        {state === "granted" && (
          <Feather name="check" size={16} color={Colors.accent} />
        )}
        {state === "denied" && (
          <Feather name="x" size={16} color={Colors.danger} />
        )}
      </View>
    </View>
  );
}

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioGranted, setAudioGranted] = useState<PermissionState>("loading");
  const [locationGranted, setLocationGranted] = useState<PermissionState>("loading");
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);

  useEffect(() => {
    requestAllPermissions();
  }, []);

  async function requestAllPermissions() {
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    setAudioGranted(audioStatus === "granted" ? "granted" : "denied");

    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(locStatus === "granted" ? "granted" : "denied");
  }

  const cameraState: PermissionState = !cameraPermission
    ? "loading"
    : cameraPermission.granted
      ? "granted"
      : "denied";

  const allGranted =
    cameraState === "granted" &&
    audioGranted === "granted" &&
    locationGranted === "granted";

  const isLoading =
    cameraState === "loading" ||
    audioGranted === "loading" ||
    locationGranted === "loading";

  if (allGranted && !selectedMode) {
    return (
      <>
        <StatusBar style="light" />
        <ModeSelectScreen onSelect={setSelectedMode} />
      </>
    );
  }

  if (allGranted && selectedMode) {
    return (
      <>
        <StatusBar style="light" />
        <CityLensScreen mode={selectedMode} onBack={() => setSelectedMode(null)} />
      </>
    );
  }

  return (
    <View style={styles.splash}>
      <StatusBar style="light" />

      <Text style={styles.logo}>CityLens</Text>
      <Text style={styles.tagline}>The world, narrated.</Text>

      <View style={styles.permissionsCard}>
        <PermissionRow label="Camera" icon="camera" state={cameraState} />
        <PermissionRow label="Microphone" icon="mic" state={audioGranted} />
        <PermissionRow label="Location" icon="map-pin" state={locationGranted} />
      </View>

      {!isLoading && (
        <TouchableOpacity
          style={styles.grantButton}
          onPress={() => {
            requestCameraPermission();
            requestAllPermissions();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.grantButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      )}

      {isLoading && (
        <Text style={styles.waitingText}>Requesting access...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 38,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 3,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "400",
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  permissionsCard: {
    marginTop: 48,
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  permLabel: {
    flex: 1,
    marginLeft: 14,
    fontSize: 15,
    fontWeight: "500",
    color: Colors.primary,
  },
  permStatusBox: {
    width: 24,
    alignItems: "center",
  },
  grantButton: {
    marginTop: 36,
    backgroundColor: Colors.primary,
    paddingHorizontal: 36,
    paddingVertical: 15,
    borderRadius: 30,
  },
  grantButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  waitingText: {
    marginTop: 36,
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
