// GlassRx — Display utilities for G2 HUD rendering
// G2 display: 576x288 monochrome green per eye

export const DISPLAY = {
  WIDTH: 576,
  HEIGHT: 288,
  MAX_CHARS_STARTUP: 1000,
  MAX_CHARS_UPDATE: 2000,
} as const;

// Box-drawing and status characters for the monochrome display
export const ICONS = {
  PILL: '[+]',
  CHECK: '[v]',
  SKIP: '[x]',
  PENDING: '[ ]',
  CLOCK: '(@)',
  ALERT: '(!)',
  ARROW_R: '>>',
  ARROW_L: '<<',
  DIVIDER: '--------------------------------',
  DIVIDER_SHORT: '----------------',
  STAR: '*',
} as const;

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function centerText(text: string, width: number = 36): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

export function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

export function progressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + '] ' + percent + '%';
}

// Format a screen with consistent header/footer
export function screenLayout(
  title: string,
  body: string,
  footer: string = 'Tap:select  Swipe:scroll  2xTap:back'
): string {
  const header = `  ${ICONS.PILL} GlassRx  |  ${title}`;
  const lines = [
    header,
    ICONS.DIVIDER,
    '',
    body,
    '',
    ICONS.DIVIDER,
    footer,
  ];
  return truncate(lines.join('\n'), DISPLAY.MAX_CHARS_UPDATE);
}
