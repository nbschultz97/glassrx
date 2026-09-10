// GlassRx — Speech-to-Text provider
// Streams PCM audio to Deepgram and returns transcripts.
// PCM format: s16le, 16kHz, mono (from G2 quad-mic array)
//
// Transport: by default the app talks to the GlassRx STT proxy Worker, which
// holds the Deepgram key server-side. A direct-to-Deepgram key is supported
// for local development ONLY — vite.config.ts refuses to make a production
// build when VITE_STT_API_KEY is set, because anything in the bundle ships
// inside the .ehpk to every user.

export interface SttSnapshot {
  finalText: string;
  interimText: string;
  finished: boolean;
}

export type SttCallback = (snapshot: SttSnapshot) => void;

const PROXY_URL = import.meta.env.VITE_STT_PROXY_URL || '';
const DEV_API_KEY = import.meta.env.VITE_STT_API_KEY || '';

// Deepgram stream parameters, shared by both transports.
const STT_PARAMS =
  'encoding=linear16&sample_rate=16000&channels=1&model=nova-2&punctuate=true&smart_format=true&interim_results=true';

let ws: WebSocket | null = null;
let onSnapshotCb: SttCallback | null = null;
let finalTranscript = '';
let interimTranscript = '';

export function isConfigured(): boolean {
  return PROXY_URL.length > 0 || (import.meta.env.DEV && DEV_API_KEY.length > 0);
}

/** Resolve the WebSocket endpoint and subprotocols for the active transport. */
function resolveEndpoint(): { url: string; protocols?: string[] } | null {
  if (PROXY_URL) {
    // PROXY_URL is the Worker origin, e.g. https://glassrx-stt-proxy.<acct>.workers.dev
    const base = PROXY_URL.replace(/\/+$/, '').replace(/^http/, 'ws');
    return { url: `${base}/v1/listen?${STT_PARAMS}` };
  }
  if (import.meta.env.DEV && DEV_API_KEY) {
    return {
      url: `wss://api.deepgram.com/v1/listen?${STT_PARAMS}`,
      protocols: ['token', DEV_API_KEY],
    };
  }
  return null;
}

export function startSttStream(onSnapshot: SttCallback): boolean {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    console.warn('GlassRx ASR: No transport configured. Set VITE_STT_PROXY_URL in .env.local');
    return false;
  }

  finalTranscript = '';
  interimTranscript = '';
  onSnapshotCb = onSnapshot;

  try {
    ws = endpoint.protocols
      ? new WebSocket(endpoint.url, endpoint.protocols)
      : new WebSocket(endpoint.url);
  } catch (err) {
    console.error('GlassRx ASR: WebSocket creation failed:', err);
    onSnapshotCb = null;
    return false;
  }

  // PCM frames are binary; ask for ArrayBuffer so send/receive stay symmetric.
  ws.binaryType = 'arraybuffer';

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
    // Copy out of the SDK's buffer: `chunk` may be a view onto a larger pooled
    // ArrayBuffer, in which case sending `.buffer` would ship unrelated bytes.
    ws.send(chunk.slice().buffer);
  }
}

export function stopSttStream(): string {
  if (ws) {
    // Ask Deepgram to flush the final transcript before the socket goes away.
    try {
      ws.send(JSON.stringify({ type: 'CloseStream' }));
    } catch {
      // ignore
    }
    const closing = ws;
    setTimeout(() => {
      closing.close();
      if (ws === closing) ws = null;
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
