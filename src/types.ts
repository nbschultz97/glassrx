// GlassRx — Medication & Supplement Tracker for Even Realities G2
// Data models

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: MedFrequency;
  times: string[]; // 24h format: ["08:00", "20:00"]
  notes: string;
  category: MedCategory;
  active: boolean;
  createdAt: number;
}

export type MedFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times'
  | 'four_times'
  | 'weekly'
  | 'as_needed';

export type MedCategory = 'prescription' | 'supplement' | 'otc';

export interface DoseLog {
  medId: string;
  medName: string;
  scheduledTime: string; // "08:00"
  date: string; // "2026-09-09"
  status: 'taken' | 'skipped' | 'missed' | 'pending';
  takenAt?: number; // unix timestamp
}

export interface ReminderAlert {
  medId: string;
  medName: string;
  dosage: string;
  scheduledTime: string;
  date: string;
}

export type Screen =
  | 'dashboard'
  | 'add_med_name'
  | 'add_med_dosage'
  | 'add_med_frequency'
  | 'add_med_times'
  | 'add_med_confirm'
  | 'reminder'
  | 'history'
  | 'med_list'
  | 'settings';

export const FREQUENCY_LABELS: Record<MedFrequency, string> = {
  once_daily: '1x daily',
  twice_daily: '2x daily',
  three_times: '3x daily',
  four_times: '4x daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

export const CATEGORY_LABELS: Record<MedCategory, string> = {
  prescription: 'Rx',
  supplement: 'Supplement',
  otc: 'OTC',
};

export const DEFAULT_TIMES: Record<MedFrequency, string[]> = {
  once_daily: ['08:00'],
  twice_daily: ['08:00', '20:00'],
  three_times: ['08:00', '14:00', '20:00'],
  four_times: ['08:00', '12:00', '16:00', '20:00'],
  weekly: ['08:00'],
  as_needed: [],
};
