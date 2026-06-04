import '../i18n';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { scheduleRetentionNotification } from '../utils/notifications';
import { getInvoices, getClients, getSettings, getProfiles } from '../utils/storage';
import { getSession, onAuthStateChange } from '../utils/auth';
import { pushLocalDataToCloud } from '../utils/sync';
import { preloadCache } from '../utils/cache';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  // undefined = auth state still loading; null = not logged in; object = logged in
  const [session, setSession] = useState(undefined);

  // Auth state listener + initial session check
  useEffect(() => {
    getSession().then(s => { setSession(s); if (s) preloadCache(); }).catch(() => setSession(null));
    const { data: { subscription } } = onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) preloadCache();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Guard: redirect based on session state
  useEffect(() => {
    if (session === undefined) return; // still loading
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments]);

  // One-time migration: push pre-existing local data to cloud on first ever login
  useEffect(() => {
    if (!session) return;
    (async () => {
      const syncedKey = `cloud_synced_${session.user.id}`;
      const alreadySynced = await AsyncStorage.getItem(syncedKey);
      if (alreadySynced) return;

      // First login for this account: upload any local data the user already had
      const [invoices, clients, settings, businessProfiles] = await Promise.all([
        getInvoices(), getClients(), getSettings(), getProfiles(),
      ]);
      await pushLocalDataToCloud({ invoices, clients, settings, businessProfiles });
      await AsyncStorage.setItem(syncedKey, '1');
    })();
  }, [session?.user?.id]);

  // Handle deep links (password reset only)
  // NOTE: Payment confirmation is NOT handled here. Payments are verified server-side
  // via pollMoMoStatus() in invoice/[id].js which polls Firebase for the real status.
  // Trusting a deep link parameter to mark an invoice paid would let any client forge
  // a payment confirmation URL — so that handler has been intentionally removed.
  useEffect(() => {
    const handleUrl = ({ url }) => {
      try {
        const parsed = Linking.parse(url);
        const hostname = parsed.hostname ?? '';
        const path = parsed.path ?? '';

        // Password reset — Supabase redirects here with ?code=xxx (PKCE flow)
        const code = parsed.queryParams?.code;
        if ((hostname === 'reset-password' || path === 'reset-password' || path === '/reset-password') && code) {
          router.replace(`/(auth)/reset-password?code=${encodeURIComponent(code)}`);
        }
      } catch (_) {}
    };

    const sub = Linking.addEventListener('url', handleUrl);
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

  // Don't render anything while checking auth (avoids flash of wrong screen)
  if (session === undefined) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="invoice/template-picker" options={{ title: 'Choose Template', headerBackTitle: '' }} />
        <Stack.Screen name="invoice/create" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="invoice/[id]" options={{ title: '', headerBackTitle: '' }} />
        <Stack.Screen name="signature" options={{ title: 'My Signature', headerBackTitle: '' }} />
        <Stack.Screen name="stamp"     options={{ title: 'Official Stamp', headerBackTitle: '' }} />
      </Stack>
    </>
  );
}
