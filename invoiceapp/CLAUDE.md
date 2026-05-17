# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server (QR code for Expo Go)
npm run android    # Android emulator
npm run web        # Browser preview
```

Always use `--clear` when debugging stale bundle issues: `npx expo start --clear`

> **Windows path:** always quote the path — `cd "c:\Users\user\Desktop\APP PROJECT\invoiceapp"` — the space in the parent folder breaks unquoted commands. Use `start.cmd` at the project root as a shortcut.

Physical device: scan the QR code in **Expo Go** after `npm start`.

## SDK 54 Breaking Changes (Expo ~54, RN 0.81)

These APIs changed and must NOT be used as they were in older SDK versions:

- **`expo-image-picker` v17:** `MediaTypeOptions` is removed. Use `mediaTypes: 'images'` (string) instead of `ImagePicker.MediaTypeOptions.Images`.
- **`expo-file-system` v19:** `EncodingType` is no longer on the module namespace. Use the string literal `'base64'` instead of `FileSystem.EncodingType.Base64`.

## Architecture

**Entry point:** `main` in `package.json` → `expo-router/entry`. The legacy `App.js` is unused.

**Routing (Expo Router v6 — file-based):**
- `app/_layout.js` — root Stack; handles deep-link `payment-confirmed` (auto-marks invoice paid); schedules idle retention notifications
- `app/(tabs)/_layout.js` — 4-tab bar: Dashboard, Invoices, Clients, Settings
- `app/invoice/create.js` — invoice/proforma creation
- `app/invoice/[id].js` — invoice detail, sharing, payment
- `app/signature.js` — signature drawing screen

**Folder conventions:**
- `components/` — Confetti, TypePickerModal, SignaturePad
- `constants/` — colors, theme tokens (Spacing/FontSize/Radius/Shadow), templates
- `utils/` — storage, invoice PDF, MoMo, Firebase, sound
- `i18n/locales/` — en.json, fr.json, rw.json (Kinyarwanda)

## Data Layer (`utils/storage.js`)

All data is **offline-first via AsyncStorage + file system**. There is no backend for core features.

| AsyncStorage key | Contents |
|---|---|
| `invoices` | Array of all invoice objects |
| `clients` | Array of saved client contacts |
| `settings` | User profile: name, address, TIN, phone, currency, language, MoMo creds, notifications |
| `businessProfiles` | Array of business profiles (multi-business support) |
| `activeProfileId` | ID of the currently active profile |

**Logo** is stored as a raw Base64 file at `FileSystem.documentDirectory + 'business_logo.jpg'` — NOT in AsyncStorage (avoids the 5–10 MB size limit). Use `getBusinessLogo()` / `saveBusinessLogo()` from storage.js. The logo is **NOT embedded in invoice JSON** — it is loaded from the file at PDF-generation time.

## Template System (`constants/templates.js`)

50 pre-built template combinations: **5 layout styles** × **10 color themes** = `t01`–`t50`.

Styles: `modern`, `classic`, `minimal`, `bold`, `dark`. Each template exports `{ primaryColor, lightColor, darkColor, headerText, style, name }`. Use `getTemplate(templateId)` to resolve.

## Invoice PDF Generation (`utils/invoice.js`)

`buildInvoiceHTML(invoice, paymentLink?)` produces an HTML string from one of five `buildModern/Classic/Minimal/Bold/Dark()` functions. Key non-obvious patterns:

- **Logo:** loaded fresh from the file system at build time (not from `invoice.logoUri`)
- **Signature:** embedded as a base64 SVG data URI
- **Payment block:** conditionally renders MoMo number/code + deep-link `paymentLink`
- **Social footer:** Instagram handle, website, email rendered as icons if present
- **Section rows:** `item.type === 'section'` renders a grouping header, not an invoice line

`shareInvoice(invoice, paymentLink)` — prints to a temp file, copies to the same directory with a clean filename (same-filesystem `copyAsync` — cross-filesystem moves fail), then calls `Sharing.shareAsync`. Always add a **≥400ms delay** after dismissing any Modal before calling `shareInvoice` to allow the native view hierarchy to settle (iOS).

`printInvoice(invoice)` — sends directly to the system print dialog.

## Invoice Object Shape

```js
{
  id, number,          // "INV-2025-0001" / "PRO-2025-0001"
  type,                // 'invoice' | 'proforma'
  templateId,          // 't01'–'t50'
  date, dueDate, createdAt,
  status,              // 'draft' | 'sent' | 'paid' | 'overdue'
  archived,
  logoUri: null,       // always null — logo loaded from file at share time
  signature,           // SVG base64 string or null
  from: { name, address, tin, phone, email, momoNumber, momoCode, instagram, website },
  to:   { name, address, tin, email },
  items: [
    { id, type: 'item',    description, notes, extra, qty, unitPrice },
    { id, type: 'section', description },   // section header row
  ],
  colHeaders: { desc, qty, price, extraLabel },
  vatRate, currency,
  subtotal, vatAmount, total,
  notes,
  paymentMethod, paymentMethodLabel,  // set when marked as paid
}
```

## MTN MoMo Integration (`utils/momo.js`)

Firebase Cloud Functions backend (`functions/index.js`). Firebase JS SDK v10 — **not** `react-native-firebase`.

- Firebase is **lazy-loaded** via dynamic `import()` inside async functions — this prevents a module crash if the placeholder config (`utils/firebase.js`) hasn't been filled in yet.
- Never use a static top-level `import` from `utils/momo` — always use dynamic `import('../../utils/momo')` at the call site.
- `requestMoMoPayment()` → `initMoMoPayment` Cloud Function → returns `referenceId`
- `pollMoMoStatus(referenceId, { onUpdate, maxAttempts: 12, intervalMs: 5000 })` → `'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'`

To activate: replace placeholders in `utils/firebase.js` and set `functions.config().momo.*` values in the Firebase project.

## Internationalization

Languages: **English** (default), **French**, **Kinyarwanda**. Translation files: `i18n/locales/{en,fr,rw}.json`.

Key namespaces: `tabs.*`, `invoice.*`, `invoice.status.*`, `payment.*`, `clients.*`, `settings.*`, `notifications.*`.

Tab bar label font size is `8` (set in `app/(tabs)/_layout.js` `tabBarLabelStyle`) to fit long Kinyarwanda words.

## Business Profile System

Settings supports multiple named business profiles. Each profile stores the full set of FROM-party fields. `getActiveProfileId()` / `setActiveProfileId()` control which profile is active. Logo is **shared across all profiles** (single file).

## Project Context

Invoice management app for the **African market** (primary: Rwanda). Always keep in mind:
- Offline-first; avoid always-online assumptions
- Default currency: **RWF**; supports USD, EUR, KES, NGN, GHS, XOF
- Mobile money is primary payment method (MTN MoMo implemented; Airtel/M-Pesa future)
- **JavaScript only** — no TypeScript
