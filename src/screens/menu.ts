// GlassRx — Menu screen
// Navigation hub for all app sections

import { getMedications, getAdherenceStats } from '../store';
import { ICONS, screenLayout } from '../utils/display';

export interface MenuState {
  selectedIndex: number;
}

export function createMenuState(): MenuState {
  return { selectedIndex: 0 };
}

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.PILL, desc: 'Upcoming doses' },
  { id: 'add_med', label: 'Add Medication', icon: ICONS.PENDING, desc: 'Add new med/supplement' },
  { id: 'med_list', label: 'My Medications', icon: ICONS.CHECK, desc: 'View & manage meds' },
  { id: 'history', label: 'History', icon: ICONS.CLOCK, desc: 'Adherence & logs' },
] as const;

export type MenuAction = (typeof MENU_ITEMS)[number]['id'];

export function renderMenu(state: MenuState): string {
  const meds = getMedications();
  const stats = getAdherenceStats(7);

  const lines: string[] = [];
  lines.push(`  ${meds.length} medication${meds.length !== 1 ? 's' : ''}  |  ${stats.rate}% adherence`);
  lines.push('');

  MENU_ITEMS.forEach((item, i) => {
    const pointer = i === state.selectedIndex ? '>>' : '  ';
    lines.push(`  ${pointer} ${item.icon}  ${item.label}`);
    lines.push(`       ${item.desc}`);
    if (i < MENU_ITEMS.length - 1) lines.push('');
  });

  return screenLayout(
    'Menu',
    lines.join('\n'),
    'Tap:select  Scroll:browse  2xTap:exit app'
  );
}

export function handleMenuScroll(
  state: MenuState,
  direction: 'up' | 'down'
): MenuState {
  const delta = direction === 'down' ? 1 : -1;
  state.selectedIndex = Math.max(
    0,
    Math.min(MENU_ITEMS.length - 1, state.selectedIndex + delta)
  );
  return state;
}
