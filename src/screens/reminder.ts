// GlassRx — Reminder alert screen
// Full-screen alert when it's time to take a medication

import type { ReminderAlert } from '../types';
import { formatTime12h } from '../scheduler';
import { ICONS, screenLayout } from '../utils/display';

export function renderReminder(alert: ReminderAlert): string {
  const time = formatTime12h(alert.scheduledTime);

  return screenLayout(
    `${ICONS.ALERT} REMINDER`,
    [
      '',
      `  ${ICONS.ALERT}  TIME TO TAKE YOUR MEDICATION  ${ICONS.ALERT}`,
      '',
      `  ${ICONS.DIVIDER_SHORT}`,
      '',
      `  ${ICONS.PILL}  ${alert.medName}`,
      `      Dose: ${alert.dosage}`,
      `      Scheduled: ${time}`,
      '',
      `  ${ICONS.DIVIDER_SHORT}`,
      '',
      '  Tap once    ->  Mark as TAKEN  ' + ICONS.CHECK,
      '  Swipe down  ->  SKIP this dose ' + ICONS.SKIP,
      '  2x Tap      ->  Snooze 10 min  ' + ICONS.CLOCK,
    ].join('\n'),
    'Tap:taken  Swipe-down:skip  2xTap:snooze'
  );
}

export function renderReminderConfirm(
  medName: string,
  action: 'taken' | 'skipped' | 'snoozed'
): string {
  const messages = {
    taken: `${ICONS.CHECK}  ${medName} marked as TAKEN`,
    skipped: `${ICONS.SKIP}  ${medName} SKIPPED`,
    snoozed: `${ICONS.CLOCK}  Snooze: reminding in 10 min`,
  };

  return screenLayout(
    'Confirmed',
    [
      '',
      '',
      '  ' + messages[action],
      '',
      '',
      '  Returning to dashboard...',
      '',
    ].join('\n'),
    ''
  );
}
