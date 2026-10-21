const ALARM_NAME = 'floatspace-focus-check';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { floatspaceTimer } = await chrome.storage.local.get('floatspaceTimer');
  if (!floatspaceTimer || floatspaceTimer.status !== 'running') return;
  const remaining = Number(floatspaceTimer.endsAt || 0) - Date.now();
  if (remaining > 0) {
    chrome.alarms.create(ALARM_NAME, { when: Date.now() + remaining });
    return;
  }
  await chrome.storage.local.set({ floatspaceTimer: { ...floatspaceTimer, status: 'completed', remainingMs: 0, endsAt: null } });
  try {
    await chrome.notifications.create('floatspace-session-complete', {
      type: 'basic', iconUrl: 'icons/icon-128.png', title: 'Floatspace · Session complete',
      message: floatspaceTimer.mode === 'focus' ? 'Nice work. Time for a break.' : 'Break complete. Ready to focus again?',
      priority: 1
    });
  } catch { /* Notifications are best-effort; the timer state remains persisted. */ }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'TIMER_UPDATED') return;
  if (message.timer?.status === 'running' && Number.isFinite(message.timer.endsAt)) {
    chrome.storage.local.set({ floatspaceTimer: message.timer });
    chrome.alarms.create(ALARM_NAME, { when: Math.max(Date.now() + 250, message.timer.endsAt) });
  } else {
    chrome.alarms.clear(ALARM_NAME);
    if (message.timer) chrome.storage.local.set({ floatspaceTimer: message.timer });
  }
});
