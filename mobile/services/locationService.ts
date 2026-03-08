import * as Location from "expo-location";
import { GPS_INTERVAL_MS } from "../constants/config";

type GPSCallback = (lat: number, lng: number) => void;

let locationTimer: ReturnType<typeof setInterval> | null = null;

export async function startLocationService(onLocation: GPSCallback) {
  // Get initial position immediately
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    onLocation(loc.coords.latitude, loc.coords.longitude);
  } catch (err) {
    console.warn("[Location] Could not get initial position:", err);
  }

  // Poll every GPS_INTERVAL_MS
  locationTimer = setInterval(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onLocation(loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      console.warn("[Location] Poll error:", err);
    }
  }, GPS_INTERVAL_MS);
}

export function stopLocationService() {
  if (locationTimer) {
    clearInterval(locationTimer);
    locationTimer = null;
  }
}
