// GlassRx — Persistent storage layer using Even Hub localStorage
// Falls back to in-memory store for simulator/dev

import type { Medication, DoseLog } from './types';

const MEDS_KEY = 'glassrx_medications';
const LOGS_KEY = 'glassrx_dose_logs';

let bridge: any = null;
// In-memory fallback
let memStore: Record<string, string> = {};

export function initStore(appBridge: any) {
  bridge = appBridge;
}

function getItem(key: string): string | null {
  if (bridge?.getLocalStorage) {
    try {
      return bridge.getLocalStorage(key);
    } catch {
      return memStore[key] ?? null;
    }
  }
  return memStore[key] ?? null;
}

function setItem(key: string, value: string): void {
  if (bridge?.setLocalStorage) {
    try {
      bridge.setLocalStorage(key, value);
    } catch {
      memStore[key] = value;
    }
  } else {
    memStore[key] = value;
  }
}

// --- Medications ---

export function getMedications(): Medication[] {
  const raw = getItem(MEDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Medication[];
  } catch {
    return [];
  }
}

export function saveMedications(meds: Medication[]): void {
  setItem(MEDS_KEY, JSON.stringify(meds));
}

export function addMedication(med: Medication): void {
  const meds = getMedications();
  meds.push(med);
  saveMedications(meds);
}

export function removeMedication(id: string): void {
  const meds = getMedications().filter((m) => m.id !== id);
  saveMedications(meds);
}

export function toggleMedication(id: string): void {
  const meds = getMedications();
  const med = meds.find((m) => m.id === id);
  if (med) {
    med.active = !med.active;
    saveMedications(meds);
  }
}

// --- Dose Logs ---

export function getDoseLogs(date?: string): DoseLog[] {
  const raw = getItem(LOGS_KEY);
  if (!raw) return [];
  try {
    const logs = JSON.parse(raw) as DoseLog[];
    if (date) return logs.filter((l) => l.date === date);
    return logs;
  } catch {
    return [];
  }
}

export function saveDoseLogs(logs: DoseLog[]): void {
  // Keep only last 30 days of logs to avoid storage limits
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = formatDate(cutoff);
  const trimmed = logs.filter((l) => l.date >= cutoffStr);
  setItem(LOGS_KEY, JSON.stringify(trimmed));
}

export function logDose(
  medId: string,
  medName: string,
  scheduledTime: string,
  status: 'taken' | 'skipped'
): void {
  const logs = getDoseLogs();
  const today = formatDate(new Date());
  // Find existing log for this dose
  const existing = logs.find(
    (l) => l.medId === medId && l.scheduledTime === scheduledTime && l.date === today
  );
  if (existing) {
    existing.status = status;
    existing.takenAt = status === 'taken' ? Date.now() : undefined;
  } else {
    logs.push({
      medId,
      medName,
      scheduledTime,
      date: today,
      status,
      takenAt: status === 'taken' ? Date.now() : undefined,
    });
  }
  saveDoseLogs(logs);
}

export function ensureTodayLogs(meds: Medication[]): DoseLog[] {
  const today = formatDate(new Date());
  const logs = getDoseLogs();
  const todayLogs = logs.filter((l) => l.date === today);

  for (const med of meds) {
    if (!med.active) continue;
    for (const time of med.times) {
      const exists = todayLogs.find(
        (l) => l.medId === med.id && l.scheduledTime === time
      );
      if (!exists) {
        const newLog: DoseLog = {
          medId: med.id,
          medName: med.name,
          scheduledTime: time,
          date: today,
          status: 'pending',
        };
        logs.push(newLog);
        todayLogs.push(newLog);
      }
    }
  }
  saveDoseLogs(logs);
  return todayLogs;
}

// --- Adherence Stats ---

export function getAdherenceStats(days: number = 7): {
  total: number;
  taken: number;
  missed: number;
  skipped: number;
  rate: number;
} {
  const logs = getDoseLogs();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = formatDate(cutoff);
  const today = formatDate(new Date());

  const relevant = logs.filter((l) => l.date >= cutoffStr && l.date < today);
  const total = relevant.length;
  const taken = relevant.filter((l) => l.status === 'taken').length;
  const missed = relevant.filter((l) => l.status === 'missed').length;
  const skipped = relevant.filter((l) => l.status === 'skipped').length;

  return {
    total,
    taken,
    missed,
    skipped,
    rate: total > 0 ? Math.round((taken / total) * 100) : 100,
  };
}

// --- Helpers ---

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export { formatDate };
