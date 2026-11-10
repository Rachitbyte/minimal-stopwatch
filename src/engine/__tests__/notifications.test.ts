import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('notifications', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported cleanly when Notification is absent', async () => {
    vi.stubGlobal('window', {});
    const mod = await import('../notifications');

    expect(mod.isNotificationsSupported()).toBe(false);
    expect(await mod.requestCountdownNotificationPermission()).toBe('unsupported');
    expect(await mod.notifyCountdownDone()).toBe(false);
  });

  it('requests permission only once per session when permission is default', async () => {
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = vi.fn(async () => {
        FakeNotification.permission = 'denied';
        return 'denied' as NotificationPermission;
      });
    }
    vi.stubGlobal('window', { Notification: FakeNotification });
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('navigator', {});

    const mod = await import('../notifications');
    expect(await mod.requestCountdownNotificationPermission()).toBe('denied');
    expect(await mod.requestCountdownNotificationPermission()).toBe('denied');
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('uses ServiceWorkerRegistration.showNotification when permission is granted', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const getRegistration = vi.fn().mockResolvedValue({ showNotification });

    class FakeNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn();
    }
    vi.stubGlobal('window', { Notification: FakeNotification });
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue({ showNotification }),
        getRegistration
      }
    });

    const mod = await import('../notifications');
    const result = await mod.notifyCountdownDone();
    expect(result).toBe(true);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][0]).toBe('Tempo — Time is up');
  });

  it('handles Android Chrome Illegal constructor error gracefully when SW is missing', async () => {
    class ThrowingNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn();
      constructor() {
        throw new TypeError('Illegal constructor');
      }
    }
    vi.stubGlobal('window', { Notification: ThrowingNotification });
    vi.stubGlobal('Notification', ThrowingNotification);
    vi.stubGlobal('navigator', {});

    const mod = await import('../notifications');
    expect(await mod.notifyCountdownDone()).toBe(false);
  });
});
