import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store adapter — stores session tokens in the device keychain/keystore,
// not in plain AsyncStorage. This protects tokens on rooted/jailbroken devices.
const SecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const SUPABASE_URL      = 'https://jycsitanxkksucttkrdp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JjLpcxEGIwCWFDK-L7pMrA_R5I2o7C1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
