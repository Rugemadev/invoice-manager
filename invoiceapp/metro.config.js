const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Exclude Supabase Edge Functions (Deno TypeScript) from the React Native bundle
config.resolver.blockList = [
  /supabase[\\/]functions[\\/].*/,
];

module.exports = config;
