import { defineConfig, loadEnv } from 'vite';

// The built bundle is packed into the .ehpk and distributed to every GlassRx
// user, so it must never contain a Deepgram key. Voice input goes through the
// STT proxy Worker (VITE_STT_PROXY_URL); VITE_STT_API_KEY exists only so the
// stream can be exercised locally without deploying the Worker.
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (command === 'build' && env.VITE_STT_API_KEY) {
    throw new Error(
      'VITE_STT_API_KEY is set for a production build.\n' +
        'That key would be embedded in dist/ and shipped inside glassrx.ehpk.\n' +
        'Remove it and set VITE_STT_PROXY_URL to the deployed Worker origin instead.'
    );
  }

  return {};
});
