// GlassRx — Microphone recorder via Even Hub SDK
// Manages audio capture lifecycle and feeds PCM to STT

import { startSttStream, sendPcm, stopSttStream, isConfigured, type SttCallback } from './stt';

let bridge: any = null;
let isRecording = false;
let recordingTimeout: ReturnType<typeof setTimeout> | null = null;

// Max recording duration (seconds) to prevent accidental long recordings
const MAX_RECORD_SECONDS = 10;

export function initRecorder(appBridge: any) {
  bridge = appBridge;
}

export function canRecord(): boolean {
  return isConfigured() && bridge != null;
}

export function startRecording(onSnapshot: SttCallback): boolean {
  if (isRecording || !bridge) return false;

  const started = startSttStream(onSnapshot);
  if (!started) return false;

  isRecording = true;

  // Enable microphone via SDK
  try {
    bridge.audioControl(true);
  } catch (err) {
    console.error('GlassRx Recorder: audioControl failed:', err);
    isRecording = false;
    return false;
  }

  // Auto-stop after MAX_RECORD_SECONDS
  recordingTimeout = setTimeout(() => {
    stopRecording();
  }, MAX_RECORD_SECONDS * 1000);

  console.log('GlassRx Recorder: Recording started');
  return true;
}

export function stopRecording(): string {
  if (!isRecording) return '';

  isRecording = false;

  if (recordingTimeout) {
    clearTimeout(recordingTimeout);
    recordingTimeout = null;
  }

  // Disable microphone
  try {
    bridge?.audioControl(false);
  } catch {
    // ignore
  }

  const transcript = stopSttStream();
  console.log('GlassRx Recorder: Recording stopped, transcript:', transcript);
  return transcript;
}

export function handleAudioEvent(audioEvent: any): void {
  if (!isRecording) return;

  const pcm = audioEvent?.audioPcm;
  if (pcm instanceof Uint8Array) {
    sendPcm(pcm);
  }
}

export function getIsRecording(): boolean {
  return isRecording;
}
