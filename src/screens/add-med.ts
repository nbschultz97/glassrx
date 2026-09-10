// GlassRx — Add Medication flow (multi-step)
// Step 1: Name (preset or voice)  →  Step 2: Dosage  →  Step 3: Frequency  →  Step 4: Confirm

import type { Medication, MedFrequency, MedCategory } from '../types';
import { FREQUENCY_LABELS, CATEGORY_LABELS, DEFAULT_TIMES } from '../types';
import { ICONS, screenLayout } from '../utils/display';
import { addMedication, generateId } from '../store';
import { formatTime12h } from '../scheduler';
import { canRecord } from '../asr/recorder';

// Wizard state
export interface AddMedState {
  step: 'name' | 'voice' | 'voice_confirm' | 'dosage' | 'frequency' | 'category' | 'confirm';
  name: string;
  dosage: string;
  frequency: MedFrequency;
  category: MedCategory;
  // For list selection
  selectedIndex: number;
  // Voice input state
  isRecording: boolean;
  voiceTranscript: string;
  voiceInterim: string;
  // Set when the mic could not be opened, so the screen can explain why.
  voiceError: string;
}

export function createAddMedState(): AddMedState {
  return {
    step: 'name',
    name: '',
    dosage: '',
    frequency: 'once_daily',
    category: 'prescription',
    selectedIndex: 0,
    isRecording: false,
    voiceTranscript: '',
    voiceInterim: '',
    voiceError: '',
  };
}

// Voice input sentinel — first item when ASR is available
const VOICE_OPTION = { name: '>> SPEAK NAME <<', dosage: '', category: 'prescription' as MedCategory };

// Preset common medications for quick add
const PRESET_MEDS = [
  // Supplements
  { name: 'Vitamin D', dosage: '1000 IU', category: 'supplement' as MedCategory },
  { name: 'Multivitamin', dosage: '1 tablet', category: 'supplement' as MedCategory },
  { name: 'Fish Oil / Omega-3', dosage: '1000 mg', category: 'supplement' as MedCategory },
  { name: 'Magnesium', dosage: '400 mg', category: 'supplement' as MedCategory },
  { name: 'Vitamin C', dosage: '500 mg', category: 'supplement' as MedCategory },
  { name: 'Vitamin B12', dosage: '1000 mcg', category: 'supplement' as MedCategory },
  { name: 'Probiotics', dosage: '1 capsule', category: 'supplement' as MedCategory },
  { name: 'Zinc', dosage: '15 mg', category: 'supplement' as MedCategory },
  { name: 'Iron', dosage: '18 mg', category: 'supplement' as MedCategory },
  { name: 'Calcium', dosage: '600 mg', category: 'supplement' as MedCategory },
  { name: 'CoQ10', dosage: '100 mg', category: 'supplement' as MedCategory },
  { name: 'Turmeric / Curcumin', dosage: '500 mg', category: 'supplement' as MedCategory },
  { name: 'Collagen', dosage: '10 g', category: 'supplement' as MedCategory },
  { name: 'Biotin', dosage: '5000 mcg', category: 'supplement' as MedCategory },
  { name: 'Melatonin', dosage: '3 mg', category: 'supplement' as MedCategory },
  { name: 'Creatine', dosage: '5 g', category: 'supplement' as MedCategory },
  { name: 'Ashwagandha', dosage: '600 mg', category: 'supplement' as MedCategory },
  { name: 'L-Theanine', dosage: '200 mg', category: 'supplement' as MedCategory },
  { name: 'Protein Powder', dosage: '1 scoop', category: 'supplement' as MedCategory },
  // OTC
  { name: 'Ibuprofen', dosage: '200 mg', category: 'otc' as MedCategory },
  { name: 'Acetaminophen', dosage: '500 mg', category: 'otc' as MedCategory },
  { name: 'Aspirin', dosage: '81 mg', category: 'otc' as MedCategory },
  { name: 'Cetirizine (Zyrtec)', dosage: '10 mg', category: 'otc' as MedCategory },
  { name: 'Loratadine (Claritin)', dosage: '10 mg', category: 'otc' as MedCategory },
  { name: 'Famotidine (Pepcid)', dosage: '20 mg', category: 'otc' as MedCategory },
  { name: 'Omeprazole (Prilosec)', dosage: '20 mg', category: 'otc' as MedCategory },
  // Common Rx
  { name: 'Lisinopril', dosage: '10 mg', category: 'prescription' as MedCategory },
  { name: 'Metformin', dosage: '500 mg', category: 'prescription' as MedCategory },
  { name: 'Atorvastatin (Lipitor)', dosage: '20 mg', category: 'prescription' as MedCategory },
  { name: 'Levothyroxine', dosage: '50 mcg', category: 'prescription' as MedCategory },
  { name: 'Amlodipine', dosage: '5 mg', category: 'prescription' as MedCategory },
  { name: 'Metoprolol', dosage: '25 mg', category: 'prescription' as MedCategory },
  { name: 'Losartan', dosage: '50 mg', category: 'prescription' as MedCategory },
  { name: 'Sertraline (Zoloft)', dosage: '50 mg', category: 'prescription' as MedCategory },
  { name: 'Escitalopram (Lexapro)', dosage: '10 mg', category: 'prescription' as MedCategory },
  { name: 'Adderall', dosage: '20 mg', category: 'prescription' as MedCategory },
  { name: 'Gabapentin', dosage: '300 mg', category: 'prescription' as MedCategory },
  { name: 'Prednisone', dosage: '10 mg', category: 'prescription' as MedCategory },
  { name: 'Amoxicillin', dosage: '500 mg', category: 'prescription' as MedCategory },
  { name: 'Birth Control Pill', dosage: '1 tablet', category: 'prescription' as MedCategory },
];

// Build the full list: voice option first (if available), then presets
function getCommonMeds() {
  const list = canRecord() ? [VOICE_OPTION, ...PRESET_MEDS] : [...PRESET_MEDS];
  return list;
}

// Exported for use in other modules if needed
export const COMMON_MEDS = PRESET_MEDS;

const FREQUENCIES: MedFrequency[] = [
  'once_daily',
  'twice_daily',
  'three_times',
  'four_times',
  'weekly',
  'as_needed',
];

const CATEGORIES: MedCategory[] = ['prescription', 'supplement', 'otc'];

const COMMON_DOSAGES = [
  '1 tablet', '2 tablets', '1 capsule', '2 capsules',
  '5 mg', '10 mg', '15 mg', '20 mg', '25 mg', '50 mg',
  '100 mg', '200 mg', '250 mg', '400 mg', '500 mg',
  '1000 mg', '1000 IU', '2000 IU', '5000 IU',
  '1 g', '5 g', '1 tsp', '1 tbsp', '1 drop', '2 drops',
  '1 spray', '2 sprays', '1 ml', '5 ml', '10 ml',
];

export function renderAddMed(state: AddMedState): string {
  switch (state.step) {
    case 'name':
      return renderNameStep(state);
    case 'voice':
      return renderVoiceStep(state);
    case 'voice_confirm':
      return renderVoiceConfirmStep(state);
    case 'dosage':
      return renderDosageStep(state);
    case 'frequency':
      return renderFrequencyStep(state);
    case 'category':
      return renderCategoryStep(state);
    case 'confirm':
      return renderConfirmStep(state);
  }
}

function renderNameStep(state: AddMedState): string {
  const meds = getCommonMeds();
  const lines: string[] = [];
  lines.push('  Select or speak medication:');
  lines.push('');

  const startIdx = Math.max(0, state.selectedIndex - 3);
  const visible = meds.slice(startIdx, startIdx + 6);

  visible.forEach((med, i) => {
    const idx = startIdx + i;
    const pointer = idx === state.selectedIndex ? '>>' : '  ';
    if (med === VOICE_OPTION) {
      lines.push(`  ${pointer} ${ICONS.ALERT} SPEAK MED NAME (voice)`);
    } else {
      const dosageStr = med.dosage ? ` (${med.dosage})` : '';
      lines.push(`  ${pointer} ${med.name}${dosageStr}`);
    }
  });

  lines.push('');
  lines.push(`  ${state.selectedIndex + 1}/${meds.length}  Scroll for more`);

  return screenLayout(
    'Add Med (1/4)',
    lines.join('\n'),
    'Tap:select  Scroll:browse  2xTap:cancel'
  );
}

function renderVoiceStep(state: AddMedState): string {
  const lines: string[] = [];

  if (state.isRecording) {
    lines.push('  Recording... speak medication name');
    lines.push('');
    lines.push(`  ${ICONS.ALERT} Listening...`);
    lines.push('');
    if (state.voiceInterim) {
      lines.push(`  Hearing: "${state.voiceInterim}"`);
    }
    if (state.voiceTranscript) {
      lines.push(`  Got: "${state.voiceTranscript}"`);
    }
    lines.push('');
    lines.push('  Tap to stop recording');
  } else if (state.voiceError) {
    lines.push(`  ${ICONS.ALERT} Voice unavailable`);
    lines.push('');
    lines.push(`  ${state.voiceError}`);
    lines.push('');
    lines.push('  Tap to retry, or 2xTap to go');
    lines.push('  back and pick from the list.');
  } else {
    lines.push('  Voice Input');
    lines.push('');
    lines.push('  Tap to start recording.');
    lines.push('  Say your medication name clearly.');
    lines.push('');
    lines.push('  Example: "Lisinopril"');
    lines.push('           "Vitamin B-12"');
    lines.push('           "Blood pressure pill"');
  }

  return screenLayout(
    'Voice Input',
    lines.join('\n'),
    state.isRecording ? 'Tap:stop  2xTap:cancel' : 'Tap:record  2xTap:back'
  );
}

function renderVoiceConfirmStep(state: AddMedState): string {
  return screenLayout(
    'Confirm Name',
    [
      '  Voice captured:',
      '',
      `  ${ICONS.PILL}  "${state.voiceTranscript}"`,
      '',
      '  Is this correct?',
      '',
      `  ${ICONS.CHECK} Tap to confirm`,
      `  ${ICONS.SKIP} 2xTap to try again`,
    ].join('\n'),
    'Tap:confirm  2xTap:retry'
  );
}

function renderDosageStep(state: AddMedState): string {
  const lines: string[] = [];
  lines.push(`  Medication: ${state.name}`);
  lines.push('');
  lines.push('  Select dosage:');
  lines.push('');

  // Find current dosage in list, or insert it
  let dosageList = [...COMMON_DOSAGES];
  if (state.dosage && !dosageList.includes(state.dosage)) {
    dosageList.unshift(state.dosage);
  }

  const startIdx = Math.max(0, state.selectedIndex - 2);
  const visible = dosageList.slice(startIdx, startIdx + 6);

  visible.forEach((dose, i) => {
    const idx = startIdx + i;
    const pointer = idx === state.selectedIndex ? '>>' : '  ';
    lines.push(`  ${pointer} ${dose}`);
  });

  lines.push('');
  lines.push(`  ${state.selectedIndex + 1}/${dosageList.length}  Scroll for more`);

  return screenLayout(
    'Add Med (2/4)',
    lines.join('\n'),
    'Tap:select  Scroll:browse  2xTap:back'
  );
}

function renderFrequencyStep(state: AddMedState): string {
  const lines: string[] = [];
  lines.push(`  ${state.name} - ${state.dosage}`);
  lines.push('');
  lines.push('  How often?');
  lines.push('');

  FREQUENCIES.forEach((freq, i) => {
    const pointer = i === state.selectedIndex ? '>>' : '  ';
    const times = DEFAULT_TIMES[freq];
    const timeStr =
      times.length > 0
        ? times.map(formatTime12h).join(', ')
        : 'No schedule';
    lines.push(`  ${pointer} ${FREQUENCY_LABELS[freq]}  (${timeStr})`);
  });

  return screenLayout(
    'Add Med (3/4)',
    lines.join('\n'),
    'Tap:select  Scroll:browse  2xTap:back'
  );
}

function renderCategoryStep(state: AddMedState): string {
  const lines: string[] = [];
  lines.push(`  ${state.name} - ${state.dosage}`);
  lines.push(`  ${FREQUENCY_LABELS[state.frequency]}`);
  lines.push('');
  lines.push('  Category:');
  lines.push('');

  CATEGORIES.forEach((cat, i) => {
    const pointer = i === state.selectedIndex ? '>>' : '  ';
    lines.push(`  ${pointer} ${CATEGORY_LABELS[cat]}`);
  });

  return screenLayout(
    'Add Med (3b/4)',
    lines.join('\n'),
    'Tap:select  Scroll:browse  2xTap:back'
  );
}

function renderConfirmStep(state: AddMedState): string {
  const times = DEFAULT_TIMES[state.frequency];
  const timeStr =
    times.length > 0
      ? times.map(formatTime12h).join(', ')
      : 'As needed';

  return screenLayout(
    'Add Med (4/4)',
    [
      '  Confirm new medication:',
      '',
      `  ${ICONS.PILL}  ${state.name}`,
      `      Dose:      ${state.dosage}`,
      `      Frequency: ${FREQUENCY_LABELS[state.frequency]}`,
      `      Times:     ${timeStr}`,
      `      Category:  ${CATEGORY_LABELS[state.category]}`,
      '',
      `  ${ICONS.CHECK} Tap to save`,
    ].join('\n'),
    'Tap:save  2xTap:cancel'
  );
}

export function handleAddMedScroll(
  state: AddMedState,
  direction: 'up' | 'down'
): AddMedState {
  const delta = direction === 'down' ? 1 : -1;
  const meds = getCommonMeds();

  switch (state.step) {
    case 'name':
      state.selectedIndex = Math.max(
        0,
        Math.min(meds.length - 1, state.selectedIndex + delta)
      );
      break;
    case 'dosage': {
      let dosageList = [...COMMON_DOSAGES];
      if (state.dosage && !dosageList.includes(state.dosage)) {
        dosageList.unshift(state.dosage);
      }
      state.selectedIndex = Math.max(
        0,
        Math.min(dosageList.length - 1, state.selectedIndex + delta)
      );
      break;
    }
    case 'frequency':
      state.selectedIndex = Math.max(
        0,
        Math.min(FREQUENCIES.length - 1, state.selectedIndex + delta)
      );
      break;
    case 'category':
      state.selectedIndex = Math.max(
        0,
        Math.min(CATEGORIES.length - 1, state.selectedIndex + delta)
      );
      break;
  }
  return state;
}

export function handleAddMedSelect(state: AddMedState): AddMedState {
  const meds = getCommonMeds();

  switch (state.step) {
    case 'name': {
      const selected = meds[state.selectedIndex];
      // Check if user selected the voice option
      if (selected === VOICE_OPTION) {
        state.step = 'voice';
        state.voiceError = '';
        state.isRecording = false;
        state.voiceTranscript = '';
        state.voiceInterim = '';
        break;
      }
      state.name = selected.name;
      state.dosage = selected.dosage;
      state.category = selected.category;
      state.step = 'dosage';
      // Point selectedIndex at the preset dosage in the dosage list
      let dosageList = [...COMMON_DOSAGES];
      if (selected.dosage && !dosageList.includes(selected.dosage)) {
        dosageList.unshift(selected.dosage);
      }
      state.selectedIndex = Math.max(0, dosageList.indexOf(selected.dosage));
      break;
    }
    case 'voice':
      // Tap toggles recording — handled in main.ts
      // This signals main.ts to start/stop recording
      state.isRecording = !state.isRecording;
      break;
    case 'voice_confirm':
      // Confirm the voice transcript as the medication name
      state.name = state.voiceTranscript;
      state.dosage = '1 tablet'; // Default, user picks in next step
      state.category = 'prescription';
      state.step = 'dosage';
      state.selectedIndex = 0;
      break;
    case 'dosage': {
      let dosageList = [...COMMON_DOSAGES];
      if (state.dosage && !dosageList.includes(state.dosage)) {
        dosageList.unshift(state.dosage);
      }
      state.dosage = dosageList[state.selectedIndex] || '1 tablet';
      state.step = 'frequency';
      state.selectedIndex = 0;
      break;
    }
    case 'frequency':
      state.frequency = FREQUENCIES[state.selectedIndex];
      state.step = 'category';
      state.selectedIndex = CATEGORIES.indexOf(state.category);
      break;
    case 'category':
      state.category = CATEGORIES[state.selectedIndex];
      state.step = 'confirm';
      break;
    case 'confirm':
      // Save the medication
      saveMedFromState(state);
      break;
  }
  return state;
}

export function handleAddMedBack(state: AddMedState): AddMedState | null {
  switch (state.step) {
    case 'name':
      return null; // Go back to dashboard
    case 'voice':
      state.isRecording = false;
      state.voiceTranscript = '';
      state.voiceInterim = '';
      state.voiceError = '';
      state.step = 'name';
      state.selectedIndex = 0;
      break;
    case 'voice_confirm':
      // Try recording again
      state.step = 'voice';
      state.isRecording = false;
      state.voiceTranscript = '';
      state.voiceInterim = '';
      state.voiceError = '';
      break;
    case 'dosage':
      state.step = 'name';
      state.selectedIndex = 0;
      break;
    case 'frequency':
      state.step = 'dosage';
      break;
    case 'category':
      state.step = 'frequency';
      state.selectedIndex = 0;
      break;
    case 'confirm':
      state.step = 'category';
      state.selectedIndex = 0;
      break;
  }
  return state;
}

// Called by main.ts to update voice transcript in real-time
export function updateVoiceTranscript(
  state: AddMedState,
  finalText: string,
  interimText: string,
  finished: boolean
): AddMedState {
  state.voiceTranscript = finalText;
  state.voiceInterim = interimText;
  if (finished && finalText) {
    state.isRecording = false;
    state.step = 'voice_confirm';
  }
  return state;
}

function saveMedFromState(state: AddMedState): Medication {
  const med: Medication = {
    id: generateId(),
    name: state.name,
    dosage: state.dosage,
    frequency: state.frequency,
    times: [...DEFAULT_TIMES[state.frequency]],
    notes: '',
    category: state.category,
    active: true,
    createdAt: Date.now(),
  };
  addMedication(med);
  return med;
}
