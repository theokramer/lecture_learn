/**
 * Notification utility functions for browser notifications
 */

/**
 * Request notification permission from the browser
 * @returns Promise that resolves to true if permission granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  // Permission is 'default' or 'prompt'
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Check if notifications are currently enabled (permission granted)
 */
export function isNotificationPermissionGranted(): boolean {
  if (!('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

/**
 * Show a browser notification
 * @param title Notification title
 * @param options Notification options
 * @returns The notification instance, or null if notifications are not supported/enabled
 */
export function showNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    return new Notification(title, {
      icon: '/vite.svg',
      badge: '/vite.svg',
      ...options,
    });
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}



