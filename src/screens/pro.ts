// GlassRx — Pro upgrade screen
//
// Activation can't happen on the glasses (no keyboard, no payment sheet), so
// this screen's only job is to hand the user a URL and a code, then reflect
// whatever the Worker says once they've paid elsewhere.

import { ICONS, screenLayout } from '../utils/display';
import { getDeviceCode, getCachedLicense, isBillingConfigured } from '../license';

export const PRO_PRICE_LABEL = '$3.99/mo';
export const PRO_URL = import.meta.env.VITE_PRO_URL || 'glassrx.app/pro';

export interface ProState {
  /** True while a license refresh is in flight, so we can show progress. */
  checking: boolean;
}

export function createProState(): ProState {
  return { checking: false };
}

export function renderPro(state: ProState): string {
  const license = getCachedLicense();
  const lines: string[] = [];

  if (!isBillingConfigured()) {
    // No Worker deployed — say so plainly instead of advertising a tier the
    // user has no way to buy.
    lines.push(`  ${ICONS.ALERT} Pro is not available yet.`);
    lines.push('');
    lines.push('  Voice input is coming soon.');
    lines.push('  Everything else in GlassRx');
    lines.push('  is free and always will be.');
    return screenLayout('GlassRx Pro', lines.join('\n'), '2xTap:back');
  }

  if (license.pro) {
    lines.push(`  ${ICONS.CHECK} Pro is active. Thank you!`);
    lines.push('');
    lines.push('  Unlocked:');
    lines.push(`    ${ICONS.PILL} Speak any medication name`);
    lines.push('');
    if (license.expiresAt) {
      const d = new Date(license.expiresAt);
      lines.push(`  Renews ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`);
    }
    lines.push('');
    lines.push('  Manage billing at:');
    lines.push(`    ${PRO_URL}`);
    return screenLayout('GlassRx Pro', lines.join('\n'), 'Tap:refresh  2xTap:back');
  }

  lines.push(`  Add any medication by voice.`);
  lines.push(`  ${PRO_PRICE_LABEL}, cancel anytime.`);
  lines.push('');
  lines.push(`  ${ICONS.DIVIDER_SHORT}`);
  lines.push('  1. On your phone, open:');
  lines.push(`       ${PRO_URL}`);
  lines.push('');
  lines.push('  2. Enter this code:');
  lines.push(`       ${ICONS.ARROW_R} ${formatCode(getDeviceCode())}`);
  lines.push(`  ${ICONS.DIVIDER_SHORT}`);
  lines.push('');
  lines.push(
    state.checking ? '  Checking...' : '  Tap here after paying to unlock.'
  );

  return screenLayout('GlassRx Pro', lines.join('\n'), 'Tap:check  2xTap:back');
}

/** "ABC123" -> "ABC 123", which is markedly easier to read off the HUD. */
function formatCode(code: string): string {
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}
