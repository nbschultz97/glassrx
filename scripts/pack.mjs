#!/usr/bin/env node
// GlassRx packaging step.
//
// The Even Hub manifest must declare exactly the permissions the shipped
// bundle actually uses, and voice input is conditional: it is compiled in only
// when VITE_STT_PROXY_URL points at a deployed STT proxy Worker. Rather than
// keeping two hand-maintained manifests in sync, derive the permission block
// from the same env that the bundle was built with.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Minimal .env reader — we only need VITE_STT_PROXY_URL. */
function readEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env };
const proxyUrl = (env.VITE_STT_PROXY_URL || '').trim();

const manifest = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));

if (proxyUrl) {
  if (proxyUrl.includes('<')) {
    throw new Error(
      `VITE_STT_PROXY_URL is still a placeholder (${proxyUrl}). ` +
        'Deploy glassrx-worker and set the real origin.'
    );
  }
  const origin = new URL(proxyUrl).origin;
  manifest.permissions = [
    {
      name: 'g2-microphone',
      desc: 'GlassRx uses the glasses microphone so you can speak a medication name instead of scrolling to find it. Audio is streamed only while you hold the voice screen open.',
    },
    {
      name: 'network',
      desc: 'GlassRx sends the audio you record to its transcription service to turn a spoken medication name into text. No medication list or dose history ever leaves the glasses.',
      whitelist: [origin],
    },
  ];
  console.log(`[pack] voice enabled — declaring g2-microphone + network (${origin})`);
} else {
  manifest.permissions = [];
  console.log('[pack] voice disabled — declaring no permissions');
}

const stageDir = mkdtempSync(join(tmpdir(), 'glassrx-pack-'));
const manifestPath = join(stageDir, 'app.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

execFileSync(
  'evenhub',
  ['pack', manifestPath, join(root, 'dist'), '--output', join(root, 'glassrx.ehpk')],
  { stdio: 'inherit' }
);
