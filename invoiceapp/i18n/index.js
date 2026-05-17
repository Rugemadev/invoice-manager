import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import fr from './locales/fr.json';
import rw from './locales/rw.json';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLocales = ['en', 'fr', 'rw'];
const fallback = supportedLocales.includes(deviceLocale) ? deviceLocale : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr }, rw: { translation: rw } },
    lng: fallback,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
