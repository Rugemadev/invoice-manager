import '../i18n';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { scheduleRetentionNotification } from '../utils/notifications';
import { getInvoices, saveInvoice } from '../utils/storage';
import { getSettings } from '../utils/storage';

export default function RootLayout() {
  const router = useRouter();

  // Handle payment confirmation deep links
  useEffect(() => {
    const handleUrl = async ({ url }) => {
      try {
        const parsed = Linking.parse(url);
        const path = parsed.path ?? '';
        const id = parsed.queryParams?.id;

        if ((path === 'payment-confirmed' || path === '/payment-confirmed') && id) {
          const invoices = await getInvoices();
          const invoice = invoices.find(i => i.id === id);
          if (invoice && invoice.status !== 'paid') {
            await saveInvoice({ ...invoice, status: 'paid' });
          }
          // Navigate to the invoice detail, triggering confetti
          router.push(`/invoice/${id}?paid=1`);
        }
      } catch (_) {}
    };

    // Handle links received while app is open
    const sub = Linking.addEventListener('url', handleUrl);

    // Handle link that launched the app
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });

    return () => sub.remove();
  }, []);

  // Schedule retention notification if idle
  useEffect(() => {
    (async () => {
      const [settings, invoices] = await Promise.all([getSettings(), getInvoices()]);
      if (!settings.notificationsEnabled) return;
      const lastCreated = invoices[0]?.createdAt;
      const daysSince = lastCreated
        ? (Date.now() - new Date(lastCreated).getTime()) / (1000 * 60 * 60 * 24)
        : 999;
      if (daysSince >= 3) await scheduleRetentionNotification();
    })();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/template-picker" options={{ title: 'Choose Template', headerBackTitle: '' }} />
        <Stack.Screen name="invoice/create" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="invoice/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="signature" options={{ title: 'My Signature', headerBackTitle: '' }} />
      </Stack>
    </>
  );
}
