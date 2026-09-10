// GlassRx — Main entry point & app router
// Medication & Supplement Tracker for Even Realities G2

import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk';

import { initStore, logDose, getMedications, ensureTodayLogs } from './store';
import { startScheduler, stopScheduler, getUpcomingDoses } from './scheduler';
import type { Screen, ReminderAlert } from './types';

// Screens
import { renderDashboard } from './screens/dashboard';
import { renderReminder, renderReminderConfirm } from './screens/reminder';
import {
  renderAddMed,
  handleAddMedSelect,
  handleAddMedScroll,
  handleAddMedBack,
  updateVoiceTranscript,
  createAddMedState,
  type AddMedState,
} from './screens/add-med';
import { initRecorder, startRecording, stopRecording, handleAudioEvent, getIsRecording } from './asr/recorder';
import {
  renderMedList,
  handleMedListSelect,
  handleMedListScroll,
  createMedListState,
  type MedListState,
} from './screens/med-list';
import { renderHistory } from './screens/history';
import { renderPro, createProState, type ProState } from './screens/pro';
import { refreshLicense } from './license';
import {
  renderMenu,
  handleMenuScroll,
  createMenuState,
  MENU_ITEMS,
  type MenuState,
  type MenuAction,
} from './screens/menu';

// ---------- App State ----------

let currentScreen: Screen = 'dashboard';
let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>;

// Screen-specific states
let addMedState: AddMedState = createAddMedState();
let medListState: MedListState = createMedListState();
let menuState: MenuState = createMenuState();
let proState: ProState = createProState();
let activeReminder: ReminderAlert | null = null;
let snoozeTimers: ReturnType<typeof setTimeout>[] = [];

// ---------- Bootstrap ----------

async function main() {
  bridge = await waitForEvenAppBridge();
  initStore(bridge);
  initRecorder(bridge);

  // Create initial page
  const mainText = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: 1,
    containerName: 'main',
    content: renderDashboard(),
    isEventCapture: 1,
  });

  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [mainText],
    })
  );

  if (result !== 0) {
    console.error('GlassRx: Failed to create startup page:', result);
    return;
  }

  // Ensure today's dose logs exist
  const meds = getMedications();
  if (meds.length > 0) {
    ensureTodayLogs(meds);
  }

  // Confirm entitlement in the background; the dashboard does not wait on it.
  void refreshLicense();

  // Start the reminder scheduler
  startScheduler(handleReminderAlert);

  // Listen for events
  bridge.onEvenHubEvent((event: any) => {
    const textEvent = event.textEvent;
    const sysEvent = event.sysEvent;
    const audioEvent = event.audioEvent;

    // Route audio to recorder
    if (audioEvent) {
      handleAudioEvent(audioEvent);
      return;
    }

    if (sysEvent) {
      handleSysEvent(sysEvent);
      return;
    }

    if (!textEvent || textEvent.containerID !== 1) return;

    switch (textEvent.eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined:
        handleTap();
        break;
      case OsEventTypeList.SCROLL_TOP_EVENT:
        handleScroll('up');
        break;
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        handleScroll('down');
        break;
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        handleDoubleTap();
        break;
    }
  });

  // Refresh dashboard every 60 seconds
  setInterval(() => {
    if (currentScreen === 'dashboard') {
      updateDisplay(renderDashboard());
    }
  }, 60_000);

  console.log('GlassRx: App started successfully');
}

// ---------- Event Handlers ----------

function handleTap() {
  switch (currentScreen) {
    case 'dashboard': {
      // If no meds, go to add med
      const meds = getMedications();
      if (meds.length === 0) {
        navigateTo('add_med_name');
        return;
      }
      // Mark next pending dose as taken
      const upcoming = getUpcomingDoses(10);
      const next = upcoming.find((d) => d.status === 'pending');
      if (next) {
        logDose(next.med.id, next.med.name, next.time, 'taken');
        updateDisplay(renderDashboard());
      } else {
        // All done — open menu so tap still does something useful
        menuState = createMenuState();
        currentScreen = 'menu' as Screen;
        updateDisplay(renderMenu(menuState));
      }
      break;
    }

    case 'reminder':
      if (activeReminder) {
        logDose(activeReminder.medId, activeReminder.medName, activeReminder.scheduledTime, 'taken');
        updateDisplay(renderReminderConfirm(activeReminder.medName, 'taken'));
        setTimeout(() => {
          activeReminder = null;
          navigateTo('dashboard');
        }, 2000);
      }
      break;

    case 'add_med_name':
    case 'add_med_dosage':
    case 'add_med_frequency':
    case 'add_med_times':
    case 'add_med_confirm': {
      // Handle voice recording toggle
      if (addMedState.step === 'voice') {
        if (getIsRecording()) {
          // Stop recording
          const transcript = stopRecording();
          if (transcript) {
            addMedState.voiceTranscript = transcript;
            addMedState.isRecording = false;
            addMedState.step = 'voice_confirm';
          } else {
            addMedState.isRecording = false;
            addMedState.voiceTranscript = '';
          }
          updateDisplay(renderAddMed(addMedState));
        } else {
          // Start recording. Opening the mic is async, so paint an optimistic
          // "listening" frame and correct it if the mic never opens.
          addMedState.voiceError = '';
          addMedState.isRecording = true;
          updateDisplay(renderAddMed(addMedState));

          void startRecording((snapshot) => {
            addMedState = updateVoiceTranscript(
              addMedState,
              snapshot.finalText,
              snapshot.interimText,
              snapshot.finished
            );
            updateDisplay(renderAddMed(addMedState));
          }).then((started) => {
            if (started) return;
            addMedState.isRecording = false;
            addMedState.voiceError = 'Mic could not be opened.';
            if (addMedState.step === 'voice') {
              updateDisplay(renderAddMed(addMedState));
            }
          });
        }
        break;
      }

      const prevStep = addMedState.step;
      addMedState = handleAddMedSelect(addMedState);
      if (addMedState.step === 'confirm' && prevStep === 'confirm') {
        // Was saved, go to dashboard
        navigateTo('dashboard');
      } else {
        updateDisplay(renderAddMed(addMedState));
      }
      break;
    }

    case 'med_list':
      medListState = handleMedListSelect(medListState);
      updateDisplay(renderMedList(medListState));
      break;

    case 'pro':
      if (!proState.checking) {
        proState.checking = true;
        updateDisplay(renderPro(proState));
        void refreshLicense().then(() => {
          proState.checking = false;
          if (currentScreen === 'pro') updateDisplay(renderPro(proState));
        });
      }
      break;

    case 'settings':
      navigateTo('dashboard');
      break;

    case 'history':
      // No actions on history, just view
      break;

    default:
      // Menu screen
      if (currentScreen === ('menu' as Screen)) {
        const action = MENU_ITEMS[menuState.selectedIndex].id as MenuAction;
        switch (action) {
          case 'dashboard':
            navigateTo('dashboard');
            break;
          case 'add_med':
            navigateTo('add_med_name');
            break;
          case 'med_list':
            navigateTo('med_list');
            break;
          case 'history':
            navigateTo('history');
            break;
          case 'pro':
            navigateTo('pro');
            break;
        }
      }
      break;
  }
}

function handleScroll(direction: 'up' | 'down') {
  switch (currentScreen) {
    case 'dashboard':
      // Scroll replaces the old double-tap route into the menu.
      menuState = createMenuState();
      currentScreen = 'menu' as Screen;
      updateDisplay(renderMenu(menuState));
      break;

    case 'add_med_name':
    case 'add_med_dosage':
    case 'add_med_frequency':
    case 'add_med_times':
    case 'add_med_confirm':
      addMedState = handleAddMedScroll(addMedState, direction);
      updateDisplay(renderAddMed(addMedState));
      break;

    case 'med_list':
      medListState = handleMedListScroll(medListState, direction);
      updateDisplay(renderMedList(medListState));
      break;

    case 'reminder':
      // Scroll down = skip dose
      if (direction === 'down' && activeReminder) {
        logDose(activeReminder.medId, activeReminder.medName, activeReminder.scheduledTime, 'skipped');
        updateDisplay(renderReminderConfirm(activeReminder.medName, 'skipped'));
        setTimeout(() => {
          activeReminder = null;
          navigateTo('dashboard');
        }, 2000);
      }
      break;

    default:
      if (currentScreen === ('menu' as Screen)) {
        menuState = handleMenuScroll(menuState, direction);
        updateDisplay(renderMenu(menuState));
      }
      break;
  }
}

function handleDoubleTap() {
  switch (currentScreen) {
    case 'dashboard':
      // Dashboard is the root page. The submission checklist requires a
      // root-page double-tap to raise the system exit dialog (exitMode 1 —
      // the user confirms), not to navigate. The menu moved to scroll.
      bridge.shutDownPageContainer(1);
      break;

    case 'reminder':
      // Snooze 10 minutes
      if (activeReminder) {
        const reminder = { ...activeReminder };
        updateDisplay(renderReminderConfirm(activeReminder.medName, 'snoozed'));
        const timer = setTimeout(() => {
          handleReminderAlert(reminder);
        }, 10 * 60 * 1000);
        snoozeTimers.push(timer);
        setTimeout(() => {
          activeReminder = null;
          navigateTo('dashboard');
        }, 2000);
      }
      break;

    case 'add_med_name':
    case 'add_med_dosage':
    case 'add_med_frequency':
    case 'add_med_times':
    case 'add_med_confirm': {
      // Stop recording if active before going back
      if (getIsRecording()) {
        stopRecording();
        addMedState.isRecording = false;
      }
      const result = handleAddMedBack(addMedState);
      if (result === null) {
        navigateTo('dashboard');
      } else {
        addMedState = result;
        updateDisplay(renderAddMed(addMedState));
      }
      break;
    }

    case 'med_list':
    case 'history':
    case 'settings':
      navigateTo('dashboard');
      break;

    case 'pro':
      navigateTo('dashboard');
      break;

    default:
      // Menu is no longer the root page, so back out to the dashboard.
      if (currentScreen === ('menu' as Screen)) {
        navigateTo('dashboard');
      }
      break;
  }
}

function handleSysEvent(sysEvent: any) {
  switch (sysEvent.eventType) {
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      // An Android WebView may have been suspended while we were away, which
      // silently kills mic capture and drops the STT socket. Neither comes
      // back on its own, so tear down any capture we think is running and
      // return the user to a state they can re-trigger, rather than leaving
      // the screen claiming "Listening..." at a dead stream.
      if (getIsRecording()) {
        stopRecording();
        addMedState.isRecording = false;
        addMedState.voiceInterim = '';
        if (!addMedState.voiceTranscript) {
          addMedState.voiceError = 'Recording stopped while away.';
        }
      }
      // Re-check entitlement too: the user may have just paid on their phone.
      void refreshLicense().then(() => {
        if (currentScreen === 'pro') updateDisplay(renderPro(proState));
      });
      refreshCurrentScreen();
      break;
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      // Release the mic rather than holding a capture the OS is about to
      // suspend anyway; a dead socket left open fails the beta lock check.
      if (getIsRecording()) {
        stopRecording();
        addMedState.isRecording = false;
      }
      break;
    case OsEventTypeList.SYSTEM_EXIT_EVENT:
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:
      cleanup();
      break;
  }
}

// ---------- Navigation ----------

function navigateTo(screen: Screen) {
  currentScreen = screen;

  switch (screen) {
    case 'dashboard':
      updateDisplay(renderDashboard());
      break;
    case 'add_med_name':
      addMedState = createAddMedState();
      updateDisplay(renderAddMed(addMedState));
      break;
    case 'med_list':
      medListState = createMedListState();
      updateDisplay(renderMedList(medListState));
      break;
    case 'history':
      updateDisplay(renderHistory());
      break;
    case 'pro':
      proState = createProState();
      updateDisplay(renderPro(proState));
      break;
    case 'reminder':
      if (activeReminder) {
        updateDisplay(renderReminder(activeReminder));
      }
      break;
  }
}

function refreshCurrentScreen() {
  switch (currentScreen) {
    case 'dashboard':
      updateDisplay(renderDashboard());
      break;
    case 'add_med_name':
    case 'add_med_dosage':
    case 'add_med_frequency':
    case 'add_med_times':
    case 'add_med_confirm':
      updateDisplay(renderAddMed(addMedState));
      break;
    case 'med_list':
      updateDisplay(renderMedList(medListState));
      break;
    case 'history':
      updateDisplay(renderHistory());
      break;
    case 'pro':
      updateDisplay(renderPro(proState));
      break;
    case 'reminder':
      if (activeReminder) {
        updateDisplay(renderReminder(activeReminder));
      }
      break;
    default:
      if (currentScreen === ('menu' as Screen)) {
        updateDisplay(renderMenu(menuState));
      }
      break;
  }
}

// ---------- Reminder Alert ----------

function handleReminderAlert(alert: ReminderAlert) {
  activeReminder = alert;
  currentScreen = 'reminder';
  updateDisplay(renderReminder(alert));
}

// ---------- Display ----------

function updateDisplay(content: string) {
  bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'main',
      content,
    })
  );
}

// ---------- Cleanup ----------

function cleanup() {
  stopScheduler();
  snoozeTimers.forEach(clearTimeout);
  snoozeTimers = [];
  (bridge as any).cleanup?.();
}

// ---------- Start ----------

main().catch((err) => {
  console.error('GlassRx: Fatal error:', err);
});
