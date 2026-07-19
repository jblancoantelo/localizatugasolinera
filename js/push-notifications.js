// Web Push Notifications

const VAPID_PUBLIC_KEY = 'BDpoYD9azs5I8SHt23Gx8BMJ6d2q1ghIluak4flDh7a2lfKIS_3tn9QFh8gaQQeG4kTYYnEl5e3S1btbH1hbNQs';
const PUSH_SUBSCRIPTION_KEY = 'gasolineras_push_subscription';

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    console.log('Notification permission already granted');
    return true;
  }

  if (Notification.permission === 'denied') {
    logPushEvent('Permission', 'denied');
    console.warn('Notification permission denied by user');
    return false;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  const ok = permission === 'granted';
  logPushEvent('Permission', ok ? 'granted' : permission);
  return ok;
}

async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return false;
  }

  try {
    const permission = await requestNotificationPermission();
    if (!permission) return false;

    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Save subscription to localStorage
    localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscription));

    let p256dhStr = 'N/A', authStr = 'N/A';
    try {
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');
      if (p256dh) p256dhStr = Array.from(new Uint8Array(p256dh)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('') + '…';
      if (auth) authStr = Array.from(new Uint8Array(auth)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) {}
    logPushEvent('Subscribe', 'éxito — endpoint: ' + subscription.endpoint + ' | p256dh: ' + p256dhStr + ' | auth: ' + authStr + ' | userVisibleOnly: true');
    console.log('User subscribed to push notifications:', subscription);
    return true;
  } catch (error) {
    logPushEvent('Subscribe', 'error: ' + error.message);
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

async function unsubscribeUserFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
    }
    // Unregister periodic sync
    try {
      if ('periodicSync' in registration) {
        const tags = await registration.periodicSync.getTags();
        if (tags.includes('check-favorite-prices')) {
          await registration.periodicSync.unregister('check-favorite-prices');
          logPushEvent('PeriodicSync', 'desregistrado');
        }
      }
    } catch (e) {
      console.warn('Could not unregister periodicSync:', e.message);
    }
    logPushEvent('Unsubscribe', 'éxito');
    console.log('User unsubscribed from push notifications');
    return true;
  } catch (error) {
    logPushEvent('Unsubscribe', 'error: ' + error.message);
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

function getPushSubscription() {
  const subJson = localStorage.getItem(PUSH_SUBSCRIPTION_KEY);
  return subJson ? JSON.parse(subJson) : null;
}

function isPushSubscribed() {
  return getPushSubscription() !== null;
}

const PUSH_LOG = [];

function logPushEvent(event, detail) {
  PUSH_LOG.unshift({
    time: formatLogTime(),
    event,
    detail
  });
  if (PUSH_LOG.length > 30) PUSH_LOG.length = 30;
  renderPushLog();
}

function renderPushLog() {
  const el = document.getElementById('pushLogEntries');
  if (!el) return;
  if (!PUSH_LOG.length) {
    el.innerHTML = '<span style="color:#999">Sin eventos registrados</span>';
    return;
  }
  el.innerHTML = PUSH_LOG.map(l =>
    `<div style="margin-bottom:0.1rem">${l.time} <b>${l.event}</b> ${l.detail}</div>`
  ).join('');
}

function clearPushLog() {
  PUSH_LOG.length = 0;
  renderPushLog();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
