// GlassRx — Speech-to-Text provider
// Streams PCM audio to Deepgram via WebSocket, returns transcripts
// PCM format: s16le, 16kHz, mono (from G2 quad-mic array)

export interface SttSnapshot {
  finalText: string;
  interimText: string;
  finished: boolean;
}

export type SttCallback = (snapshot: SttSnapshot) => void;

const API_KEY = import.meta.env.VITE_STT_API_KEY || '';

let ws: WebSocket | null = null;
let onSnapshotCb: SttCallback | null = null;
let finalTranscript = '';
let interimTranscript = '';

export function isConfigured(): boolean {
  return API_KEY.length > 0;
}

export function startSttStream(onSnapshot: SttCallback): boolean {
  if (!isConfigured()) {
    console.warn('GlassRx ASR: No API key configured. Set VITE_STT_API_KEY in .env.local');
    return false;
  }

  finalTranscript = '';
  interimTranscript = '';
  onSnapshotCb = onSnapshot;

  const url = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&punctuate=true&smart_format=true`;

  try {
    ws = new WebSocket(url, ['token', API_KEY]);
  } catch (err) {
    console.error('GlassRx ASR: WebSocket creation failed:', err);
    return false;
  }

  ws.onopen = () => {
    console.log('GlassRx ASR: Stream connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'Results' && data.channel?.alternatives?.length > 0) {
        const alt = data.channel.alternatives[0];
        const text = alt.transcript || '';

        if (data.is_final) {
          if (text) {
            finalTranscript += (finalTranscript ? ' ' : '') + text;
          }
          interimTranscript = '';
        } else {
          interimTranscript = text;
        }

        onSnapshotCb?.({
          finalText: finalTranscript.trim(),
          interimText: interimTranscript.trim(),
          finished: false,
        });
      }
    } catch (err) {
      console.error('GlassRx ASR: Parse error:', err);
    }
  };

  ws.onerror = (err) => {
    console.error('GlassRx ASR: WebSocket error:', err);
  };

  ws.onclose = () => {
    console.log('GlassRx ASR: Stream closed');
    onSnapshotCb?.({
      finalText: finalTranscript.trim(),
      interimText: '',
      finished: true,
    });
  };

  return true;
}

export function sendPcm(chunk: Uint8Array): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(chunk.buffer as ArrayBuffer);
  }
}

export function stopSttStream(): string {
  if (ws) {
    // Send close message to Deepgram to flush final transcript
    try {
      ws.send(JSON.stringify({ type: 'CloseStream' }));
    } catch {
      // ignore
    }
    setTimeout(() => {
      ws?.close();
      ws = null;
    }, 500);
  }
  onSnapshotCb = null;
  const result = finalTranscript.trim();
  finalTranscript = '';
  interimTranscript = '';
  return result;
}

export function getTranscript(): string {
  return (finalTranscript + ' ' + interimTranscript).trim();
}
