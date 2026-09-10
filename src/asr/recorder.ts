// GlassRx — Microphone recorder via Even Hub SDK
// Manages audio capture lifecycle and feeds PCM to STT

import { AudioInputSource } from '@evenrealities/even_hub_sdk';

import { isPro } from '../license';
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
  // Voice is the paid tier. The Worker enforces this too — this check only
  // keeps the option off the list for users who can't use it.
  return isConfigured() && bridge != null && isPro();
}

export async function startRecording(onSnapshot: SttCallback): Promise<boolean> {
  if (isRecording || !bridge) return false;

  const started = startSttStream(onSnapshot);
  if (!started) return false;

  isRecording = true;

  // Enable the glasses microphone. audioControl resolves to false when the OS
  // denies the mic (missing g2-microphone permission, or the startup page is
  // not up yet) — treat that as a failed start rather than sitting in a
  // "listening" state that will never receive audio.
  let opened = false;
  try {
    opened = await bridge.audioControl(true, AudioInputSource.Glasses);
  } catch (err) {
    console.error('GlassRx Recorder: audioControl failed:', err);
  }

  if (!opened) {
    console.error('GlassRx Recorder: microphone unavailable');
    isRecording = false;
    stopSttStream();
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
