// GlassRx — Medication list screen
// Shows all medications with ability to toggle active/inactive

import { getMedications, toggleMedication, removeMedication } from '../store';
import { FREQUENCY_LABELS, CATEGORY_LABELS } from '../types';
import { ICONS, screenLayout } from '../utils/display';
import { formatTime12h } from '../scheduler';

export interface MedListState {
  selectedIndex: number;
  confirmDelete: boolean;
}

export function createMedListState(): MedListState {
  return { selectedIndex: 0, confirmDelete: false };
}

export function renderMedList(state: MedListState): string {
  const meds = getMedications();

  if (meds.length === 0) {
    return screenLayout(
      'My Medications',
      [
        '',
        '  No medications added yet.',
        '',
        '  Go back and tap to add one.',
        '',
      ].join('\n'),
      '2xTap: back to dashboard'
    );
  }

  if (state.confirmDelete) {
    const med = meds[state.selectedIndex];
    return screenLayout(
      'Delete?',
      [
        '',
        `  Remove ${med.name}?`,
        `  ${med.dosage} - ${FREQUENCY_LABELS[med.frequency]}`,
        '',
        '  Tap:  YES, remove',
        '  2xTap: NO, keep it',
        '',
      ].join('\n'),
      'Tap:delete  2xTap:cancel'
    );
  }

  const lines: string[] = [];
  const startIdx = Math.max(0, state.selectedIndex - 2);
  const visible = meds.slice(startIdx, startIdx + 5);

  visible.forEach((med, i) => {
    const idx = startIdx + i;
    const pointer = idx === state.selectedIndex ? '>>' : '  ';
    const activeIcon = med.active ? ICONS.CHECK : ICONS.SKIP;
    const timeStr = med.times.length > 0
      ? med.times.map(formatTime12h).join(', ')
      : 'As needed';

    lines.push(
      `  ${pointer} ${activeIcon} ${med.name}`
    );
    lines.push(
      `       ${med.dosage} | ${FREQUENCY_LABELS[med.frequency]} | ${CATEGORY_LABELS[med.category]}`
    );
    lines.push(
      `       ${timeStr}`
    );
    if (i < visible.length - 1) lines.push('');
  });

  lines.push('');
  lines.push(`  ${state.selectedIndex + 1}/${meds.length} medications`);

  return screenLayout(
    'My Medications',
    lines.join('\n'),
    'Tap:toggle  Scroll:browse  2xTap:back'
  );
}

export function handleMedListScroll(
  state: MedListState,
  direction: 'up' | 'down'
): MedListState {
  const meds = getMedications();
  const delta = direction === 'down' ? 1 : -1;
  state.selectedIndex = Math.max(
    0,
    Math.min(meds.length - 1, state.selectedIndex + delta)
  );
  return state;
}

export function handleMedListSelect(state: MedListState): MedListState {
  const meds = getMedications();

  if (state.confirmDelete) {
    // Confirm deletion
    const med = meds[state.selectedIndex];
    removeMedication(med.id);
    state.confirmDelete = false;
    state.selectedIndex = Math.max(0, state.selectedIndex - 1);
    return state;
  }

  // Toggle active/inactive
  if (meds[state.selectedIndex]) {
    toggleMedication(meds[state.selectedIndex].id);
  }
  return state;
}
