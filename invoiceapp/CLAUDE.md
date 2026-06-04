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
- **`expo-file-system` v19:** All legacy methods (`readAsStringAsync`, `writeAsStringAsync`, `copyAsync`, `deleteAsync`, etc.) throw errors when imported from `expo-file-system`. Always import from `'expo-file-system/legacy'` instead. `EncodingType` is also gone — use the string `'base64'` directly.
- **`expo-notifications`:** Trigger objects require a `type` field. Use `{ type: 'timeInterval', seconds: N }` for time-based triggers instead of the bare `{ seconds: N }` shape.

## Architecture

**Entry point:** `main` in `package.json` → `expo-router/entry`. The legacy `App.js` is unused.

**Routing (Expo Router v6 — file-based):**
- `app/_layout.js` — root Stack; owns auth guard (redirects unauthenticated users to `/(auth)/login`); handles deep links (`payment-confirmed`, `reset-password`); runs first-login cloud sync; schedules idle retention notifications
- `app/(auth)/` — login, signup, forgot-password, reset-password (password reset uses Supabase PKCE flow via deep link `invoiceapp://reset-password?code=xxx`)
- `app/(tabs)/_layout.js` — 4-tab bar: Dashboard, Invoices, Clients, Settings
- `app/invoice/create.js` — invoice/proforma creation; receives `type` + `docTitle` + `templateId` as URL params from template-picker
- `app/invoice/[id].js` — invoice detail, sharing, payment collection, reminders
- `app/signature.js` — signature drawing screen

**Folder conventions:**
- `components/` — Confetti, TypePickerModal, SignaturePad
- `constants/` — colors, theme tokens (Spacing/FontSize/Radius/Shadow), templates
- `utils/` — storage, invoice PDF, MoMo, Firebase, Supabase, auth, sync, sound, stamp scanner
- `i18n/locales/` — en.json, fr.json, rw.json (Kinyarwanda)

## Authentication & Cloud Sync

**Auth:** Supabase (`utils/supabase.js` + `utils/auth.js`). Session is persisted in AsyncStorage. `app/_layout.js` runs an auth guard on every navigation: unauthenticated → `/(auth)/login`; authenticated in auth group → `/(tabs)`.

**Cloud sync** (`utils/sync.js`): All writes to invoices, clients, settings, and business profiles fire a background Supabase upsert — but they are **fire-and-forget** (called with `.then().catch()`, never awaited directly). Local AsyncStorage is always written first; the cloud sync is best-effort. On first login for an account, `pushLocalDataToCloud()` uploads any pre-existing local data. `pullFromCloud()` is used to restore data after sign-in.

**Supabase tables:** `invoices`, `clients`, `business_profiles`, `settings` — all keyed by `user_id`, storing the full object as a `data` JSONB column.

## Data Layer (`utils/storage.js`)

All data is **offline-first via AsyncStorage + file system**. Import from `'expo-file-system/legacy'`.

| AsyncStorage key | Contents |
|---|---|
| `invoices` | Array of all invoice objects |
| `clients` | Array of saved client contacts |
| `settings` | User profile: name, address, TIN, phone, currency, language, MoMo creds, notifications |
| `businessProfiles` | Array of business profiles (multi-business support) |
| `activeProfileId` | ID of the currently active profile |
| `products` | Array of saved product/service catalog items |

**File-system assets** (stored at `FileSystem.documentDirectory`, NOT in AsyncStorage):
- `business_logo.jpg` — logo as raw base64; use `getBusinessLogo()` / `saveBusinessLogo()`
- `business_stamp.svg` — stamp as raw SVG text; use `getStamp()` / `getStampDataUri()` / `saveStamp()`

Neither asset is embedded in invoice JSON — both are loaded fresh from the file at PDF-generation time.

## Template System (`constants/templates.js`)

50 pre-built template combinations: **5 layout styles** × **10 color themes** = `t01`–`t50`.

Styles: `modern`, `classic`, `minimal`, `bold`, `dark`. Each template exports `{ primaryColor, lightColor, darkColor, headerText, style, name }`. Use `getTemplate(templateId)` to resolve.

## Invoice PDF Generation (`utils/invoice.js`)

`buildInvoiceHTML(invoice, paymentLink?)` produces an HTML string from one of five `buildModern/Classic/Minimal/Bold/Dark()` functions. Key non-obvious patterns:

- **Logo:** loaded fresh via `getBusinessLogo()` unless `invoice.noLogo` is true (set when no logo existed at create time)
- **Stamp:** loaded via `getStampDataUri()`, rendered at the bottom of every PDF
- **Signature:** embedded as a base64 SVG data URI
- **Social footer:** Instagram handle, website, email rendered as icon links if present
- **Section rows:** `item.type === 'section'` renders a grouping header row, not a line item
- MoMo number/code are intentionally **not** rendered in the PDF

`shareInvoice(invoice, paymentLink)` — prints to a temp file in `cacheDirectory`, copies to a named `ClientName_INV-XXX_YYYYMMDD.pdf` file in the same `cacheDirectory` (same filesystem = no cross-filesystem copy failure), then calls `Sharing.shareAsync`. Always add a **≥400ms delay** after dismissing any Modal before calling `shareInvoice` to allow the native view hierarchy to settle (iOS).

`printInvoice(invoice)` — sends directly to the system print dialog.

## Invoice Object Shape

```js
{
  id, number,          // "INV-2025-0001" / "PRO-2025-0001"
  type,                // 'invoice' | 'proforma'
  docTitle,            // display title: 'Invoice', 'Receipt', 'Quotation', etc.
  templateId,          // 't01'–'t50'
  date, dueDate, createdAt,
  status,              // 'draft' | 'sent' | 'paid' | 'overdue'
  archived,
  noLogo,              // true if no logo existed when invoice was created
  logoUri: null,       // always null — logo loaded from file at share time
  signature,           // SVG base64 data URI or null
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

## Document Type Flow

The "+" FAB on the Invoices tab opens `TypePickerModal`, which calls `onSelect({ type, docTitle })`. The 7 types (`Invoice`, `Proforma Invoice`, `Delivery Note`, `Receipt`, `Quotation`, `Purchase Order`, `Credit Note`) map to either `type: 'invoice'` or `type: 'proforma'`. The selection is passed as URL params through `template-picker.js` → `create.js`. `create.js` no longer has an inline doc type picker.

## SVG Rendering in React Native

React Native's `<Image>` component cannot display `data:image/svg+xml;base64,...` URIs — it silently renders nothing. Use `<SvgXml xml={svgString} />` from `react-native-svg` instead. To get the raw SVG string from a base64 data URI: `atob(dataUri.slice('data:image/svg+xml;base64,'.length))`. This applies to signatures and stamps everywhere they're previewed in the UI.

## Stamp Scanner (`utils/claude.js`)

`scanStampWithClaude(base64Image)` — calls OpenAI GPT-4o Vision API with a photo of a physical rubber stamp, returns a clean SVG string. The API key is hardcoded in the file. No user-visible key required. Do **not** rename the file — it is imported by name throughout the codebase.

## MTN MoMo Integration (`utils/momo.js`)

Firebase Cloud Functions backend (`functions/index.js`). Firebase JS SDK v10 — **not** `react-native-firebase`.

- Firebase is **lazy-loaded** via dynamic `import()` inside async functions — prevents a module crash if the placeholder config (`utils/firebase.js`) hasn't been filled in.
- Never use a static top-level `import` from `utils/momo` — always use dynamic `import('../../utils/momo')` at the call site.
- `requestMoMoPayment()` → `initMoMoPayment` Cloud Function → returns `referenceId`
- `pollMoMoStatus(referenceId, { onUpdate, maxAttempts: 12, intervalMs: 5000 })` → `'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'`

To activate: replace placeholders in `utils/firebase.js` and set `functions.config().momo.*` values in the Firebase project.

## Settings — Logo Race Condition (Android)

`ImagePicker.launchImageLibraryAsync` on Android causes a screen focus/blur cycle, which re-triggers `useFocusEffect` before `pickLogo` finishes. The fix in `settings.js`:
- `logoUri` is kept in its own `useState`, separate from the `form` object
- `isPickingLogo = useRef(false)` guards the `useFocusEffect` logo reset: `if (!isPickingLogo.current) setLogoUri(logoData)`
- `pickLogo` sets the ref `true` before the picker and `false` immediately after it returns, before any state updates

Do not revert this pattern — merging `logoUri` back into `form` will reintroduce the race condition.

## Internationalization

Languages: **English** (default), **French**, **Kinyarwanda**. Translation files: `i18n/locales/{en,fr,rw}.json`.

Key namespaces: `tabs.*`, `invoice.*`, `invoice.status.*`, `payment.*`, `clients.*`, `settings.*`, `notifications.*`.

Tab bar label font size is `8` (set in `app/(tabs)/_layout.js` `tabBarLabelStyle`) to fit long Kinyarwanda words.

## Business Profile System

Settings supports multiple named business profiles. Each profile stores the full set of FROM-party fields. `getActiveProfileId()` / `setActiveProfileId()` control which profile is active. Logo and stamp are **shared across all profiles** (single file each).

## Project Context

Invoice management app for the **African market** (primary: Rwanda). Always keep in mind:
- Offline-first; avoid always-online assumptions
- Default currency: **RWF**; supports USD, EUR, KES, NGN, GHS, XOF
- Mobile money is primary payment method (MTN MoMo implemented; Airtel/M-Pesa future)
- **JavaScript only** — no TypeScript
