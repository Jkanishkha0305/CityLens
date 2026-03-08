import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";

// Queue of base64 PCM chunks waiting to be played
const playbackQueue: string[] = [];
let isPlaying = false;
let playbackEnabled = false;

/**
 * Build a WAV file buffer from raw PCM bytes.
 * Gemini sends PCM 16-bit, 24kHz, Mono.
 */
function buildWAVBase64(pcmBase64: string): string {
  const pcmBytes = Buffer.from(pcmBase64, "base64");
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.length;
  const headerSize = 44;

  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF chunk
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");

  // fmt sub-chunk
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);          // PCM
  buf.writeUInt16LE(1, 20);           // AudioFormat = PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  pcmBytes.copy(buf, headerSize);

  return buf.toString("base64");
}

async function processQueue() {
  if (isPlaying || playbackQueue.length === 0 || !playbackEnabled) return;

  isPlaying = true;
  const pcmBase64 = playbackQueue.shift()!;

  try {
    const wavBase64 = buildWAVBase64(pcmBase64);
    const tmpPath = `${FileSystem.cacheDirectory}cl_audio_${Date.now()}.wav`;

    await FileSystem.writeAsStringAsync(tmpPath, wavBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: tmpPath },
      { shouldPlay: true, volume: 1.0 }
    );

    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          FileSystem.deleteAsync(tmpPath, { idempotent: true });
          resolve();
        }
      });
    });
  } catch (err) {
    console.warn("[AudioPlayback] Error playing chunk:", err);
  }

  isPlaying = false;
  // Process next chunk if any
  processQueue();
}

export function enqueueAudioChunk(pcmBase64: string) {
  if (!playbackEnabled) return;
  playbackQueue.push(pcmBase64);
  processQueue();
}

export function startPlayback() {
  playbackEnabled = true;
  Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });
}

export function stopPlayback() {
  playbackEnabled = false;
  playbackQueue.length = 0;
}
