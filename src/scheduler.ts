// GlassRx — Reminder scheduler
// Checks medication schedules and triggers alerts

import type { Medication, ReminderAlert } from './types';
import { getMedications, getDoseLogs, formatDate } from './store';

let checkInterval: ReturnType<typeof setInterval> | null = null;
let onAlert: ((alert: ReminderAlert) => void) | null = null;
let alertedThisCycle: Set<string> = new Set();

// How many minutes before scheduled time to show reminder
const EARLY_REMINDER_MINUTES = 2;
// How many minutes after to mark as missed
const MISSED_THRESHOLD_MINUTES = 60;

export function startScheduler(alertCallback: (alert: ReminderAlert) => void) {
  onAlert = alertCallback;
  // Check every 30 seconds
  checkInterval = setInterval(checkReminders, 30_000);
  // Immediate check on start
  checkReminders();
}

export function stopScheduler() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  onAlert = null;
}

function checkReminders() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = formatDate(now);
  const meds = getMedications();
  const todayLogs = getDoseLogs(today);

  for (const med of meds) {
    if (!med.active) continue;

    for (const timeStr of med.times) {
      const [h, m] = timeStr.split(':').map(Number);
      const scheduledMinutes = h * 60 + m;
      const alertKey = `${med.id}_${timeStr}_${today}`;

      // Check if already logged
      const log = todayLogs.find(
        (l) => l.medId === med.id && l.scheduledTime === timeStr
      );
      if (log && (log.status === 'taken' || log.status === 'skipped')) {
        continue;
      }

      // Check if within reminder window
      const diff = currentMinutes - scheduledMinutes;
      if (
        diff >= -EARLY_REMINDER_MINUTES &&
        diff <= MISSED_THRESHOLD_MINUTES &&
        !alertedThisCycle.has(alertKey)
      ) {
        alertedThisCycle.add(alertKey);
        if (onAlert) {
          onAlert({
            medId: med.id,
            medName: med.name,
            dosage: med.dosage,
            scheduledTime: timeStr,
            date: today,
          });
        }
      }

      // Reset alert flag after the missed window passes
      if (diff > MISSED_THRESHOLD_MINUTES) {
        alertedThisCycle.delete(alertKey);
      }
    }
  }
}

export function getUpcomingDoses(count: number = 5): {
  med: Medication;
  time: string;
  minutesUntil: number;
  isPast: boolean;
  status: string;
}[] {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = formatDate(now);
  const meds = getMedications();
  const todayLogs = getDoseLogs(today);

  const doses: {
    med: Medication;
    time: string;
    minutesUntil: number;
    isPast: boolean;
    status: string;
  }[] = [];

  for (const med of meds) {
    if (!med.active) continue;

    for (const timeStr of med.times) {
      const [h, m] = timeStr.split(':').map(Number);
      const scheduledMinutes = h * 60 + m;
      const minutesUntil = scheduledMinutes - currentMinutes;

      const log = todayLogs.find(
        (l) => l.medId === med.id && l.scheduledTime === timeStr
      );

      doses.push({
        med,
        time: timeStr,
        minutesUntil,
        isPast: minutesUntil < 0,
        status: log?.status ?? 'pending',
      });
    }
  }

  // Sort: pending first (by time), then taken/skipped
  doses.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return a.minutesUntil - b.minutesUntil;
  });

  return doses.slice(0, count);
}

export function formatTimeUntil(minutes: number): string {
  if (minutes < 0) {
    const abs = Math.abs(minutes);
    if (abs < 60) return `${abs}m ago`;
    return `${Math.floor(abs / 60)}h ${abs % 60}m ago`;
  }
  if (minutes === 0) return 'NOW';
  if (minutes < 60) return `in ${minutes}m`;
  return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
