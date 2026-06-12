import { supabase } from './supabase';

// Map Supabase error messages to safe, user-facing strings.
// Never expose raw internal errors (schema details, stack traces, etc.) to the UI.
const SAFE_ERRORS = {
  'invalid login credentials':    'Incorrect email or password.',
  'email not confirmed':           'Please verify your email before signing in.',
  'user already registered':       'An account with this email already exists.',
  'password should be at least':   'Password is too short.',
  'rate limit':                    'Too many attempts. Please wait a moment and try again.',
  'network request failed':        'Network error. Check your connection and try again.',
  'token has expired':             'Your session has expired. Please sign in again.',
  'invalid otp':                   'Invalid or expired code. Please request a new one.',
  'expired':                       'This link has expired. Please request a new one.',
};

export function sanitizeAuthError(err) {
  const raw = (err?.message ?? '').toLowerCase();
  for (const [key, friendly] of Object.entries(SAFE_ERRORS)) {
    if (raw.includes(key)) return friendly;
  }
  // Generic fallback — never expose the raw message
  return 'Something went wrong. Please try again.';
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'bilvo://reset-password',
  });
  if (error) throw error;
}

export async function exchangeCodeForSession(code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
