let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let hasRequestedPermissionThisSession = false;

export function isNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistrationPromise) return swRegistrationPromise;

  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    typeof window === 'undefined'
  ) {
    swRegistrationPromise = Promise.resolve(null);
    return swRegistrationPromise;
  }

  const base = import.meta.env.BASE_URL || '/';
  const swUrl = `${base}sw.js`;

  swRegistrationPromise = navigator.serviceWorker
    .register(swUrl, { scope: base })
    .catch(() => null);

  return swRegistrationPromise;
}

export async function requestCountdownNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationsSupported()) return 'unsupported';

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  if (hasRequestedPermissionThisSession) {
    return Notification.permission;
  }

  hasRequestedPermissionThisSession = true;
  try {
    void registerNotificationServiceWorker();
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notifyCountdownDone(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const base = import.meta.env.BASE_URL || '/';
  const title = 'Tempo — Time is up';
  const options: NotificationOptions = {
    body: 'Your countdown has finished.',
    icon: `${base}icon.png`,
    badge: `${base}icon.png`,
    tag: 'tempo-countdown-done'
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration(base)) ??
        (await registerNotificationServiceWorker());
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Fall back to window Notification below (note: Android Chrome requires SW)
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
