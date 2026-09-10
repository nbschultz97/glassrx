/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the GlassRx STT proxy Worker, e.g.
   * https://glassrx-stt-proxy.<account>.workers.dev
   * This is the supported way to enable voice input: the Deepgram key stays
   * on the Worker and never enters the bundle.
   */
  readonly VITE_STT_PROXY_URL: string;
  /**
   * Direct Deepgram key. LOCAL DEVELOPMENT ONLY — a production build with this
   * set is rejected by vite.config.ts, because the bundle ships to every user
   * inside the .ehpk.
   */
  readonly VITE_STT_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
