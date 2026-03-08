import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { AUDIO_CHUNK_MS } from "../constants/config";

// iOS: CAF with linearPCM gives closest to raw 16-bit PCM at 16kHz
// Android: uses DEFAULT format — backend receives encoded audio
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".wav",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: ".caf",
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

let isCapturing = false;
let captureLoop: ReturnType<typeof setTimeout> | null = null;

export async function startAudioCapture(
  onChunk: (base64Audio: string) => void
) {
  if (isCapturing) return;
  isCapturing = true;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const loop = async () => {
    if (!isCapturing) return;

    let recording: Audio.Recording | null = null;
    try {
      recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();

      await new Promise<void>((resolve) =>
        setTimeout(resolve, AUDIO_CHUNK_MS)
      );

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        onChunk(base64);

        // Clean up temp file
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (err) {
      // Silently continue — don't crash the capture loop on transient errors
      console.warn("[AudioCapture] Chunk error:", err);
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
      }
    }

    if (isCapturing) {
      // Schedule next chunk immediately — no gap
      captureLoop = setTimeout(loop, 0);
    }
  };

  loop();
}

export function stopAudioCapture() {
  isCapturing = false;
  if (captureLoop) {
    clearTimeout(captureLoop);
    captureLoop = null;
  }
}
