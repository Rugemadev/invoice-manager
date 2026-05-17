# Invoice Manager — African Market

A full-featured mobile invoice management app built with React Native and Expo, designed for freelancers and small businesses in Africa. Supports offline-first workflows, multiple currencies, MTN MoMo payments, and three languages.

## Features

- **50+ invoice templates** — 5 layout styles × 10 color themes
- **PDF generation & sharing** — share directly from your phone
- **Offline-first** — all data stored locally, no internet required for core features
- **Multi-currency** — RWF, USD, EUR, KES, NGN, GHS, XOF
- **Multi-language** — English, French, Kinyarwanda
- **MTN MoMo integration** — request payment directly from an invoice
- **Client management** — save and reuse client contacts
- **Multi-business profiles** — manage multiple brands in one app
- **Proforma invoices** — in addition to standard invoices
- **Digital signatures** — draw and embed signatures on PDFs
- **Live invoice preview** — see the invoice as you build it

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 / Expo SDK 54 |
| Navigation | Expo Router v6 (file-based) |
| Storage | AsyncStorage + Expo FileSystem (offline-first) |
| PDF | expo-print + expo-sharing |
| Payments | Firebase Cloud Functions + MTN MoMo Collections API |
| Internationalization | i18next + react-i18next |
| Icons | @expo/vector-icons (Ionicons) |

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) app installed on your phone

### Installation

```bash
git clone <repo-url>
cd invoiceapp
npm install
npm start
```

Scan the QR code with Expo Go to open the app on your device.

> **Windows:** use `start.cmd` at the project root as a shortcut — it runs `npx expo start --clear` with the correct path.

## MTN MoMo / Firebase Setup

The core app works fully offline without Firebase. MoMo payment collection requires a Firebase project:

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com)

2. **Fill in `invoiceapp/utils/firebase.js`** with your project credentials:
   ```js
   const firebaseConfig = {
     apiKey: 'YOUR_API_KEY',
     authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
     projectId: 'YOUR_PROJECT_ID',
     // ...
   };
   ```

3. **Install and deploy Cloud Functions:**
   ```bash
   npm install -g firebase-tools
   cd functions && npm install
   firebase deploy --only functions
   ```

4. **Set MTN MoMo API credentials** on the function config:
   ```bash
   firebase functions:config:set \
     momo.api_key="YOUR_API_KEY" \
     momo.api_secret="YOUR_API_SECRET" \
     momo.subscription_key="YOUR_SUBSCRIPTION_KEY" \
     momo.env="sandbox"
   ```
   Get credentials from the [MTN MoMo Developer Portal](https://momodeveloper.mtn.com).

## Project Structure

```
APP PROJECT/
├── invoiceapp/          # React Native / Expo app
│   ├── app/             # Expo Router screens
│   │   ├── (tabs)/      # Bottom tab screens
│   │   └── invoice/     # Invoice create + detail screens
│   ├── components/      # Confetti, TypePickerModal, SignaturePad
│   ├── constants/       # Colors, theme tokens, templates (t01–t50)
│   ├── i18n/locales/    # en.json, fr.json, rw.json
│   └── utils/           # storage, invoice PDF, MoMo, Firebase
└── functions/           # Firebase Cloud Functions (MoMo backend)
```

## Supported Currencies

RWF · USD · EUR · KES · NGN · GHS · XOF

## Languages

English · Français · Kinyarwanda
