// GlassRx — History & adherence screen
// Shows dose history and adherence stats

import { getDoseLogs, getAdherenceStats, formatDate } from '../store';
import { formatTime12h } from '../scheduler';
import { ICONS, screenLayout, progressBar } from '../utils/display';

export function renderHistory(): string {
  const stats7 = getAdherenceStats(7);
  const stats30 = getAdherenceStats(30);
  const today = formatDate(new Date());
  const todayLogs = getDoseLogs(today);

  const lines: string[] = [];

  // Stats section
  lines.push('  Adherence Overview');
  lines.push(`  ${ICONS.DIVIDER_SHORT}`);
  lines.push(`  7-Day:  ${progressBar(stats7.rate, 14)}`);
  lines.push(`  30-Day: ${progressBar(stats30.rate, 14)}`);
  lines.push('');

  // Breakdown
  lines.push(`  7-Day: ${stats7.taken} taken, ${stats7.missed} missed, ${stats7.skipped} skipped`);
  lines.push('');

  // Today's log
  lines.push('  Today:');
  lines.push(`  ${ICONS.DIVIDER_SHORT}`);

  if (todayLogs.length === 0) {
    lines.push('  No doses scheduled today.');
  } else {
    const sorted = [...todayLogs].sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime)
    );
    for (const log of sorted.slice(0, 6)) {
      const icon =
        log.status === 'taken'
          ? ICONS.CHECK
          : log.status === 'skipped'
          ? ICONS.SKIP
          : log.status === 'missed'
          ? ICONS.ALERT
          : ICONS.PENDING;
      const time = formatTime12h(log.scheduledTime);
      lines.push(`  ${icon} ${log.medName}  ${time}  ${log.status}`);
    }
    if (sorted.length > 6) {
      lines.push(`  ... and ${sorted.length - 6} more`);
    }
  }

  return screenLayout(
    'History',
    lines.join('\n'),
    '2xTap: back to dashboard'
  );
}
