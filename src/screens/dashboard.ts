// GlassRx — Dashboard screen
// Shows upcoming doses, adherence rate, and quick actions

import { getUpcomingDoses, formatTimeUntil, formatTime12h } from '../scheduler';
import { getMedications, getAdherenceStats, ensureTodayLogs } from '../store';
import { ICONS, screenLayout, progressBar } from '../utils/display';

export function renderDashboard(): string {
  const meds = getMedications();

  if (meds.length === 0) {
    return screenLayout(
      'Dashboard',
      [
        centerWelcome(),
        '',
        '  Welcome to GlassRx!',
        '',
        '  No medications added yet.',
        '',
        '  Tap to add your first',
        '  medication or supplement.',
      ].join('\n'),
      'Tap:add med  Scroll:menu  2xTap:exit'
    );
  }

  // Ensure today's dose logs exist
  ensureTodayLogs(meds);

  const upcoming = getUpcomingDoses(4);
  const stats = getAdherenceStats(7);
  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  const lines: string[] = [];

  // Adherence bar
  lines.push(`  7-Day Adherence: ${progressBar(stats.rate, 16)}`);
  lines.push('');

  // Upcoming doses
  lines.push(`  Next Doses          Now: ${timeStr}`);
  lines.push(`  ${ICONS.DIVIDER_SHORT}`);

  if (upcoming.length === 0) {
    lines.push('  All done for today! ' + ICONS.CHECK);
  } else {
    for (const dose of upcoming) {
      const statusIcon =
        dose.status === 'taken'
          ? ICONS.CHECK
          : dose.status === 'skipped'
          ? ICONS.SKIP
          : dose.status === 'pending'
          ? ICONS.PENDING
          : ICONS.ALERT;

      const timeLabel = formatTime12h(dose.time);
      const untilLabel = formatTimeUntil(dose.minutesUntil);
      const name =
        dose.med.name.length > 14
          ? dose.med.name.slice(0, 14) + '..'
          : dose.med.name;

      lines.push(
        `  ${statusIcon} ${name}  ${dose.med.dosage}  ${timeLabel}  ${untilLabel}`
      );
    }
  }

  lines.push('');
  lines.push(`  ${meds.length} med${meds.length !== 1 ? 's' : ''} active  |  ${stats.taken}/${stats.total} taken this week`);

  return screenLayout(
    'Dashboard',
    lines.join('\n'),
    'Tap:mark taken  Scroll:menu  2xTap:exit'
  );
}

function centerWelcome(): string {
  return [
    '',
    '    +---------------------------+',
    '    |     [+] G l a s s R x     |',
    '    |   Medication  Tracker     |',
    '    +---------------------------+',
  ].join('\n');
}
