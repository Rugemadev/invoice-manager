import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function scheduleRetentionNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Welcome back! 👋',
      body: "You haven't created an invoice in a while. Stay on top of your business!",
      sound: true,
    },
    trigger: {
      seconds: 60 * 60 * 24 * 3, // 3 days
      repeats: false,
    },
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
