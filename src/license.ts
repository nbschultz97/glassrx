// GlassRx — Pro licensing
//
// The glasses have no text entry and no payment surface, so activation is
// indirect: the app mints a short device code, the user types that code into
// the checkout page on their phone or laptop, and Stripe's webhook marks the
// code active on the Worker. The app then polls for its own status.
//
// Nothing here is a security boundary — the Worker is what actually refuses to
// transcribe for an inactive code. This module only decides what UI to show.

import { getStoredValue, setStoredValue } from './store';

const DEVICE_CODE_KEY = 'glassrx_device_code';
const LICENSE_CACHE_KEY = 'glassrx_license';

// Unambiguous alphabet — no O/0, I/1, S/5 — because users read this off a
// low-resolution monochrome HUD and retype it on another device.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789';
const CODE_LENGTH = 6;

const PROXY_URL = import.meta.env.VITE_STT_PROXY_URL || '';

export interface LicenseStatus {
  pro: boolean;
  /** Epoch ms when this status was last confirmed with the server. */
  checkedAt: number;
  /** Epoch ms the subscription is paid through, when known. */
  expiresAt: number | null;
}

const INACTIVE: LicenseStatus = { pro: false, checkedAt: 0, expiresAt: null };

export function getDeviceCode(): string {
  const existing = getStoredValue(DEVICE_CODE_KEY);
  if (existing && existing.length === CODE_LENGTH) return existing;

  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  setStoredValue(DEVICE_CODE_KEY, code);
  return code;
}

/** Last known status. Cached so the Pro screen renders instantly offline. */
export function getCachedLicense(): LicenseStatus {
  const raw = getStoredValue(LICENSE_CACHE_KEY);
  if (!raw) return INACTIVE;
  try {
    const parsed = JSON.parse(raw) as LicenseStatus;
    // A lapsed subscription stays cached as pro until the next successful
    // refresh; expire it locally so an offline device can't hold Pro forever.
    if (parsed.expiresAt !== null && Date.now() > parsed.expiresAt) {
      return { ...parsed, pro: false };
    }
    return parsed;
  } catch {
    return INACTIVE;
  }
}

export function isPro(): boolean {
  return getCachedLicense().pro;
}

export function isBillingConfigured(): boolean {
  return PROXY_URL.length > 0;
}

/**
 * Ask the Worker whether this device code is active. Resolves to the status it
 * stored; on any network failure the cached status is left alone and returned,
 * so a dropped connection never revokes Pro mid-session.
 */
export async function refreshLicense(): Promise<LicenseStatus> {
  if (!PROXY_URL) return INACTIVE;

  const base = PROXY_URL.replace(/\/+$/, '');
  const url = `${base}/v1/license?code=${encodeURIComponent(getDeviceCode())}`;

  try {
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) return getCachedLicense();

    const data = (await resp.json()) as { pro?: boolean; expires_at?: number | null };
    const status: LicenseStatus = {
      pro: data.pro === true,
      checkedAt: Date.now(),
      expiresAt: typeof data.expires_at === 'number' ? data.expires_at : null,
    };
    setStoredValue(LICENSE_CACHE_KEY, JSON.stringify(status));
    return status;
  } catch {
    return getCachedLicense();
  }
}
