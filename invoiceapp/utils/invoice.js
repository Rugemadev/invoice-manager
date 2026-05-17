import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getTemplate } from '../constants/templates';
import { getSettings, getBusinessLogo } from './storage';

export function generateId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function calcInvoice(items, vatRate) {
  const subtotal = Math.round(
    items.reduce((sum, item) =>
      sum + (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0), 0) * 100
  ) / 100;
  const vatAmount = Math.round(subtotal * ((parseFloat(vatRate) || 0) / 100) * 100) / 100;
  return { subtotal, vatAmount, total: Math.round((subtotal + vatAmount) * 100) / 100 };
}

export function formatCurrency(amount, currency = 'RWF') {
  const num = Math.round(parseFloat(amount) || 0);
  if (currency === 'RWF') return `${num.toLocaleString()} RWF`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
  } catch {
    return `${num.toLocaleString()} ${currency}`;
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safeName(str) {
  return (str ?? 'Document').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_') || 'Invoice';
}

// Convert a local file:// URI to base64 data URI; pass-through if already data:
async function uriToBase64(uri) {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const ext = uri.split('.').pop().toLowerCase().split('?')[0];
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch { return null; }
}

// ─── Social footer ────────────────────────────────────────────────────────────

const IG_ICON = (c) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`;
const MAIL_ICON = (c) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
const WEB_ICON = (c) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;

function buildSocialFooter(from, primaryColor, style) {
  const ig = from?.instagram?.trim();
  const mail = from?.businessEmail?.trim();
  const web = from?.website?.trim();
  if (!ig && !mail && !web) return '';

  const isDark = style === 'dark';
  const borderColor = isDark ? '#1E293B' : '#E5E7EB';
  const textColor = isDark ? '#94A3B8' : '#6B7280';

  const items = [
    ig   ? `<div style="display:flex;align-items:center;gap:5px">${IG_ICON(primaryColor)}<span style="font-size:11px;color:${primaryColor};font-weight:500">${ig}</span></div>` : '',
    mail ? `<div style="display:flex;align-items:center;gap:5px">${MAIL_ICON(primaryColor)}<span style="font-size:11px;color:${textColor}">${mail}</span></div>` : '',
    web  ? `<div style="display:flex;align-items:center;gap:5px">${WEB_ICON(primaryColor)}<span style="font-size:11px;color:${textColor}">${web}</span></div>` : '',
  ].filter(Boolean).join('');

  return `<div style="margin-top:28px;padding-top:16px;border-top:1px solid ${borderColor};display:flex;gap:20px;flex-wrap:wrap;align-items:center">${items}</div>`;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function itemRows(items, currency) {
  return (items ?? []).map(item => {
    if (item.type === 'section') {
      return { type: 'section', desc: item.description, extra: '', qty: '', price: '', total: '' };
    }
    const lineTotal = Math.round((parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0));
    const qty = parseFloat(item.qty) % 1 === 0 ? parseInt(item.qty, 10) : parseFloat(item.qty);
    return { type: 'item', desc: item.description, notes: item.notes ?? '', extra: item.extra ?? '', qty, price: formatCurrency(item.unitPrice, currency), total: formatCurrency(lineTotal, currency) };
  });
}

function fromBlock(from, color) {
  return `
    <div style="font-size:14px;font-weight:700;color:inherit">${from?.name ?? ''}</div>
    ${from?.address ? `<div style="font-size:12px;line-height:1.5;margin-top:3px">${from.address.replace(/\n/g,'<br/>')}</div>` : ''}
    ${from?.tin    ? `<div style="font-size:12px;margin-top:2px">TIN: ${from.tin}</div>` : ''}
    ${from?.phone  ? `<div style="font-size:12px">${from.phone}</div>` : ''}
    ${from?.email  ? `<div style="font-size:12px;color:${color}">${from.email}</div>` : ''}`;
}

function toBlock(to, color) {
  return `
    <div style="font-size:14px;font-weight:700;color:inherit">${to?.name ?? ''}</div>
    ${to?.address ? `<div style="font-size:12px;line-height:1.5;margin-top:3px">${to.address.replace(/\n/g,'<br/>')}</div>` : ''}
    ${to?.tin     ? `<div style="font-size:12px;margin-top:2px">TIN: ${to.tin}</div>` : ''}
    ${to?.email   ? `<div style="font-size:12px;color:${color}">${to.email}</div>` : ''}`;
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildModern(inv, tpl, docTitle, logoSrc, rows, cur, sub, vat, total, payHtml, notes, sig, social, colHeaders) {
  const { primaryColor: p, lightColor: lc, darkColor: dc, headerText: ht } = tpl;
  const ch = colHeaders ?? {};
  const descLabel = ch.desc || 'Description';
  const qtyLabel  = ch.qty  || 'Qty';
  const priceLabel = ch.price || 'Unit Price';
  const extraLabel = ch.extraLabel || '';
  const hasExtra = !!extraLabel;
  const colCount = hasExtra ? 5 : 4;
  const descW  = hasExtra ? '35%' : '44%';
  const extraW = '14%';
  const qtyW   = hasExtra ? '7%' : '8%';
  const numW   = hasExtra ? '22%' : '24%';

  const trs = rows.map((r, i) => {
    if (r.type === 'section') {
      return `<tr><td colspan="${colCount}" style="padding:10px 14px;font-size:13px;font-weight:700;color:${p};background:${lc}88">${r.desc}</td></tr>`;
    }
    return `
    <tr style="background:${i % 2 === 0 ? '#fff' : lc + '55'}">
      <td style="padding:11px 14px;font-size:13px">${r.desc}${r.notes ? `<div style="font-size:11px;color:#94A3B8;margin-top:3px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:11px 14px;font-size:13px">${r.extra}</td>` : ''}
      <td style="padding:11px 14px;text-align:center;font-size:13px">${r.qty}</td>
      <td style="padding:11px 14px;text-align:right;font-size:13px">${r.price}</td>
      <td style="padding:11px 14px;text-align:right;font-size:13px;font-weight:600">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Helvetica,Arial,sans-serif;color:#1E293B">
<div style="max-width:800px;margin:0 auto;padding:40px">
  <div style="background:${p};border-radius:16px;padding:36px 40px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" style="height:64px;max-width:160px;object-fit:contain;object-position:left;display:block;border-radius:8px;margin-bottom:14px"/>` : ''}
      <div style="font-size:30px;font-weight:900;color:${ht};letter-spacing:-0.5px">${docTitle}</div>
    </div>
    <div style="text-align:right;color:${ht}">
      <div style="font-size:20px;font-weight:700">${inv.number}</div>
      <div style="opacity:0.8;margin-top:6px;font-size:13px">${formatDate(inv.date)}</div>
      ${inv.dueDate ? `<div style="opacity:0.7;font-size:12px">Due ${formatDate(inv.dueDate)}</div>` : ''}
      <div style="margin-top:10px;display:inline-block;background:rgba(255,255,255,0.22);border-radius:20px;padding:4px 14px;font-size:10px;font-weight:700;letter-spacing:1px">${(inv.status ?? 'DRAFT').toUpperCase()}</div>
    </div>
  </div>
  <div style="display:flex;gap:16px;margin-bottom:28px">
    <div style="flex:1;background:#fff;border-radius:12px;padding:22px;color:#1E293B">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${p};margin-bottom:10px">From</div>
      ${fromBlock(inv.from, p)}
    </div>
    <div style="flex:1;background:#fff;border-radius:12px;padding:22px;color:#1E293B">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${p};margin-bottom:10px">Billed To</div>
      ${toBlock(inv.to, p)}
    </div>
  </div>
  <div style="background:#fff;border-radius:12px;overflow:hidden;margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead><tr style="background:${lc}">
        <th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${descW}">${descLabel}</th>
        ${hasExtra ? `<th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${extraW}">${extraLabel}</th>` : ''}
        <th style="padding:12px 14px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${qtyW}">${qtyLabel}</th>
        <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${numW}">${priceLabel}</th>
        <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${numW}">Total</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </div>
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <div style="background:#fff;border-radius:12px;padding:20px 24px;min-width:280px">
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;color:#64748B"><span>Subtotal</span><span>${formatCurrency(sub, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;color:#64748B;border-bottom:1px solid #E2E8F0"><span>VAT (${inv.vatRate ?? 0}%)</span><span>${formatCurrency(vat, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:12px 0 4px;font-size:18px;font-weight:800;color:${p}"><span>TOTAL</span><span>${formatCurrency(total, cur)}</span></div>
    </div>
  </div>
  ${notes ? `<div style="background:#fff;border-radius:12px;padding:18px;margin-bottom:18px;font-size:12px;color:#64748B"><strong style="color:#1E293B">Notes: </strong>${notes}</div>` : ''}
  ${sig}${social}${payHtml}
</div></body></html>`;
}

function buildClassic(inv, tpl, docTitle, logoSrc, rows, cur, sub, vat, total, payHtml, notes, sig, social, colHeaders) {
  const { primaryColor: p, lightColor: lc, headerText: ht } = tpl;
  const ch = colHeaders ?? {};
  const descLabel = ch.desc || 'Description';
  const qtyLabel  = ch.qty  || 'Qty';
  const priceLabel = ch.price || 'Unit Price';
  const extraLabel = ch.extraLabel || '';
  const hasExtra = !!extraLabel;
  const colCount = hasExtra ? 5 : 4;
  const descW  = hasExtra ? '35%' : '44%';
  const extraW = '14%';
  const qtyW   = hasExtra ? '7%' : '8%';
  const numW   = hasExtra ? '22%' : '24%';

  const trs = rows.map((r, i) => {
    if (r.type === 'section') {
      return `<tr><td colspan="${colCount}" style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    return `
    <tr style="${i % 2 !== 0 ? `background:${lc}44` : ''}">
      <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;font-size:13px">${r.desc}${r.notes ? `<div style="font-size:11px;color:#94A3B8;margin-top:3px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;font-size:13px">${r.extra}</td>` : ''}
      <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;text-align:center;font-size:13px">${r.qty}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-size:13px">${r.price}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-size:13px;font-weight:600">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
  <div style="height:10px;background:${p}"></div>
  <div style="max-width:800px;margin:0 auto;padding:40px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:2px solid ${p};margin-bottom:28px">
      <div>
        ${logoSrc ? `<img src="${logoSrc}" style="height:64px;max-width:160px;object-fit:contain;object-position:left;display:block;border-radius:8px;margin-bottom:14px"/>` : ''}
        <div style="font-size:28px;font-weight:700;color:${p};font-family:Helvetica,Arial,sans-serif">${docTitle}</div>
      </div>
      <div style="text-align:right;font-family:Helvetica,Arial,sans-serif">
        <div style="font-size:22px;font-weight:700">${inv.number}</div>
        <div style="color:#666;margin-top:4px;font-size:13px">${formatDate(inv.date)}</div>
        ${inv.dueDate ? `<div style="color:#666;font-size:12px">Due: ${formatDate(inv.dueDate)}</div>` : ''}
        <div style="margin-top:8px;display:inline-block;border:1.5px solid ${p};color:${p};border-radius:4px;padding:2px 10px;font-size:10px;font-weight:700">${(inv.status ?? 'DRAFT').toUpperCase()}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:32px;font-family:Helvetica,Arial,sans-serif">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${p};border-bottom:1px solid ${p};padding-bottom:3px;margin-bottom:10px">From</div>
        ${fromBlock(inv.from, p)}
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${p};border-bottom:1px solid ${p};padding-bottom:3px;margin-bottom:10px">Bill To</div>
        ${toBlock(inv.to, p)}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:Helvetica,Arial,sans-serif;margin-bottom:24px">
      <thead><tr style="background:${p}">
        <th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${descW}">${descLabel}</th>
        ${hasExtra ? `<th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${extraW}">${extraLabel}</th>` : ''}
        <th style="padding:12px 14px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${qtyW}">${qtyLabel}</th>
        <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${numW}">${priceLabel}</th>
        <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${numW}">Total</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
      <table style="width:280px;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:13px">
        <tr><td style="padding:7px 0;color:#666">Subtotal</td><td style="padding:7px 0;text-align:right">${formatCurrency(sub, cur)}</td></tr>
        <tr><td style="padding:7px 0;color:#666">VAT (${inv.vatRate ?? 0}%)</td><td style="padding:7px 0;text-align:right">${formatCurrency(vat, cur)}</td></tr>
        <tr style="border-top:2px solid ${p}">
          <td style="padding:12px 0;font-weight:700;font-size:16px;color:${p}">TOTAL</td>
          <td style="padding:12px 0;text-align:right;font-weight:700;font-size:16px;color:${p}">${formatCurrency(total, cur)}</td>
        </tr>
      </table>
    </div>
    ${notes ? `<p style="font-size:12px;color:#666;font-family:Helvetica,Arial,sans-serif"><strong style="color:#1a1a1a">Notes: </strong>${notes}</p>` : ''}
    ${sig}${social}${payHtml}
  </div>
  <div style="height:6px;background:${p};margin-top:40px"></div>
</body></html>`;
}

function buildMinimal(inv, tpl, docTitle, logoSrc, rows, cur, sub, vat, total, payHtml, notes, sig, social, colHeaders) {
  const { primaryColor: p } = tpl;
  const ch = colHeaders ?? {};
  const descLabel = ch.desc || 'Description';
  const qtyLabel  = ch.qty  || 'Qty';
  const priceLabel = ch.price || 'Price';
  const extraLabel = ch.extraLabel || '';
  const hasExtra = !!extraLabel;
  const colCount = hasExtra ? 5 : 4;
  const descW  = hasExtra ? '35%' : '44%';
  const extraW = '14%';
  const qtyW   = hasExtra ? '7%' : '8%';
  const numW   = hasExtra ? '22%' : '24%';

  const trs = rows.map(r => {
    if (r.type === 'section') {
      return `<tr><td colspan="${colCount}" style="padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:13px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    return `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid #F1F5F9;font-size:13px">${r.desc}${r.notes ? `<div style="font-size:11px;color:#94A3B8;margin-top:3px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:13px 0;border-bottom:1px solid #F1F5F9;font-size:13px">${r.extra}</td>` : ''}
      <td style="padding:13px 0;border-bottom:1px solid #F1F5F9;text-align:center;font-size:13px">${r.qty}</td>
      <td style="padding:13px 0;border-bottom:1px solid #F1F5F9;text-align:right;font-size:13px">${r.price}</td>
      <td style="padding:13px 0;border-bottom:1px solid #F1F5F9;text-align:right;font-size:13px;font-weight:600">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:720px;margin:0 auto;padding:60px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:28px;border-bottom:1px solid #E5E7EB;margin-bottom:52px">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" style="height:56px;max-width:140px;object-fit:contain;object-position:left;display:block;border-radius:8px;margin-bottom:18px"/>` : ''}
      <div style="font-size:10px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:${p}">${docTitle}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:26px;font-weight:300;letter-spacing:-0.5px">${inv.number}</div>
      <div style="font-size:12px;color:#9CA3AF;margin-top:6px">${formatDate(inv.date)}</div>
      ${inv.dueDate ? `<div style="font-size:12px;color:#9CA3AF">Due ${formatDate(inv.dueDate)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;gap:60px;margin-bottom:52px">
    <div style="flex:1">
      <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px">From</div>
      ${fromBlock(inv.from, p)}
    </div>
    <div style="flex:1">
      <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#9CA3AF;margin-bottom:12px">Billed To</div>
      ${toBlock(inv.to, p)}
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:44px">
    <thead><tr style="border-bottom:1px solid #E5E7EB">
      <th style="padding-bottom:14px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${descW}">${descLabel}</th>
      ${hasExtra ? `<th style="padding-bottom:14px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${extraW}">${extraLabel}</th>` : ''}
      <th style="padding-bottom:14px;text-align:center;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${qtyW}">${qtyLabel}</th>
      <th style="padding-bottom:14px;text-align:right;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${numW}">${priceLabel}</th>
      <th style="padding-bottom:14px;text-align:right;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${numW}">Total</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
    <div style="text-align:right">
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:4px">Subtotal: ${formatCurrency(sub, cur)} &nbsp;|&nbsp; VAT ${inv.vatRate ?? 0}%: ${formatCurrency(vat, cur)}</div>
      <div style="border-top:2px solid ${p};padding-top:14px;margin-top:8px">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px">Total Due</div>
        <div style="font-size:38px;font-weight:200;color:${p};letter-spacing:-1px">${formatCurrency(total, cur)}</div>
      </div>
    </div>
  </div>
  ${notes ? `<p style="font-size:12px;color:#6B7280;border-top:1px solid #F1F5F9;padding-top:18px"><em><strong>Notes: </strong>${notes}</em></p>` : ''}
  ${sig}${social}${payHtml}
</div></body></html>`;
}

function buildBold(inv, tpl, docTitle, logoSrc, rows, cur, sub, vat, total, payHtml, notes, sig, social, colHeaders) {
  const { primaryColor: p, lightColor: lc, darkColor: dc, headerText: ht } = tpl;
  const ch = colHeaders ?? {};
  const descLabel = ch.desc || 'Description';
  const qtyLabel  = ch.qty  || 'Qty';
  const priceLabel = ch.price || 'Unit Price';
  const extraLabel = ch.extraLabel || '';
  const hasExtra = !!extraLabel;
  const colCount = hasExtra ? 5 : 4;
  const descW  = hasExtra ? '35%' : '44%';
  const extraW = '14%';
  const qtyW   = hasExtra ? '7%' : '8%';
  const numW   = hasExtra ? '22%' : '24%';

  const trs = rows.map((r, i) => {
    if (r.type === 'section') {
      return `<tr><td colspan="${colCount}" style="padding:10px 16px;font-size:13px;font-weight:700;color:${p};background:${lc}88">${r.desc}</td></tr>`;
    }
    return `
    <tr style="${i % 2 !== 0 ? `background:${lc}77` : ''}">
      <td style="padding:12px 16px;font-size:13px">${r.desc}${r.notes ? `<div style="font-size:11px;color:#94A3B8;margin-top:3px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:12px 16px;font-size:13px">${r.extra}</td>` : ''}
      <td style="padding:12px 16px;text-align:center;font-size:13px">${r.qty}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px">${r.price}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:700">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#1E293B">
  <div style="background:${p};padding:48px 52px 44px">
    <div style="font-size:52px;font-weight:900;color:${ht};line-height:1;text-transform:uppercase;letter-spacing:-2px">${docTitle}</div>
    <div style="color:${ht};opacity:0.75;font-size:16px;font-weight:300;margin-top:8px;letter-spacing:1px">${inv.number}</div>
    ${logoSrc ? `<img src="${logoSrc}" style="height:52px;max-width:130px;object-fit:contain;object-position:left;display:block;border-radius:6px;margin-top:22px"/>` : ''}
  </div>
  <div style="background:${lc};padding:18px 52px;display:flex;gap:48px">
    <div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${dc};margin-bottom:3px">Date</div><div style="font-weight:700;color:${dc}">${formatDate(inv.date)}</div></div>
    ${inv.dueDate ? `<div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${dc};margin-bottom:3px">Due</div><div style="font-weight:700;color:${dc}">${formatDate(inv.dueDate)}</div></div>` : ''}
    <div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${dc};margin-bottom:3px">Status</div><div style="font-weight:900;color:${p};text-transform:uppercase">${inv.status ?? 'draft'}</div></div>
  </div>
  <div style="padding:44px 52px">
    <div style="display:flex;justify-content:space-between;margin-bottom:40px">
      <div>
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#94A3B8;margin-bottom:10px">From</div>
        ${fromBlock(inv.from, p)}
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#94A3B8;margin-bottom:10px">Billed To</div>
        ${toBlock(inv.to, p)}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:28px">
      <thead><tr style="background:${dc}">
        <th style="padding:13px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${descW}">${descLabel}</th>
        ${hasExtra ? `<th style="padding:13px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${extraW}">${extraLabel}</th>` : ''}
        <th style="padding:13px 16px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${qtyW}">${qtyLabel}</th>
        <th style="padding:13px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${numW}">${priceLabel}</th>
        <th style="padding:13px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${numW}">Total</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:18px">
      <table style="width:260px;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 0;color:#64748B">Subtotal</td><td style="padding:6px 0;text-align:right">${formatCurrency(sub, cur)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748B">VAT (${inv.vatRate ?? 0}%)</td><td style="padding:6px 0;text-align:right">${formatCurrency(vat, cur)}</td></tr>
      </table>
    </div>
    <div style="background:${p};border-radius:10px;padding:22px 28px;text-align:right;margin-bottom:28px">
      <div style="color:${ht};opacity:0.75;font-size:10px;text-transform:uppercase;letter-spacing:2px">Total Amount Due</div>
      <div style="color:${ht};font-size:36px;font-weight:900;letter-spacing:-1px;margin-top:4px">${formatCurrency(total, cur)}</div>
    </div>
    ${notes ? `<p style="font-size:12px;color:#64748B"><strong style="color:#1E293B">Notes: </strong>${notes}</p>` : ''}
    ${sig}${social}${payHtml}
  </div>
</body></html>`;
}

function buildDark(inv, tpl, docTitle, logoSrc, rows, cur, sub, vat, total, payHtml, notes, sig, social, colHeaders) {
  const { primaryColor: p } = tpl;
  const ch = colHeaders ?? {};
  const descLabel = ch.desc || 'Description';
  const qtyLabel  = ch.qty  || 'Qty';
  const priceLabel = ch.price || 'Unit Price';
  const extraLabel = ch.extraLabel || '';
  const hasExtra = !!extraLabel;
  const colCount = hasExtra ? 5 : 4;
  const descW  = hasExtra ? '35%' : '44%';
  const extraW = '14%';
  const qtyW   = hasExtra ? '7%' : '8%';
  const numW   = hasExtra ? '22%' : '24%';

  const trs = rows.map(r => {
    if (r.type === 'section') {
      return `<tr><td colspan="${colCount}" style="padding:10px 0;border-bottom:1px solid #1E293B;font-size:13px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    return `
    <tr>
      <td style="padding:13px 0;border-bottom:1px solid #1E293B;font-size:13px;color:#CBD5E1">${r.desc}${r.notes ? `<div style="font-size:11px;color:#94A3B8;margin-top:3px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:13px 0;border-bottom:1px solid #1E293B;font-size:13px;color:#CBD5E1">${r.extra}</td>` : ''}
      <td style="padding:13px 0;border-bottom:1px solid #1E293B;text-align:center;font-size:13px;color:#CBD5E1">${r.qty}</td>
      <td style="padding:13px 0;border-bottom:1px solid #1E293B;text-align:right;font-size:13px;color:#CBD5E1">${r.price}</td>
      <td style="padding:13px 0;border-bottom:1px solid #1E293B;text-align:right;font-size:13px;font-weight:600;color:#F1F5F9">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Helvetica,Arial,sans-serif;color:#CBD5E1">
<div style="max-width:800px;margin:0 auto;padding:52px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:32px;border-bottom:1px solid ${p}44;margin-bottom:40px">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" style="height:56px;max-width:140px;object-fit:contain;object-position:left;display:block;border-radius:6px;margin-bottom:16px"/>` : ''}
      <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${p};font-weight:700">${docTitle}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:700;color:#F1F5F9">${inv.number}</div>
      <div style="color:#475569;font-size:13px;margin-top:6px">${formatDate(inv.date)}</div>
      ${inv.dueDate ? `<div style="color:#475569;font-size:12px">Due: ${formatDate(inv.dueDate)}</div>` : ''}
      <div style="margin-top:10px;display:inline-block;border:1px solid ${p};color:${p};border-radius:20px;padding:3px 14px;font-size:10px;font-weight:700;letter-spacing:1px">${(inv.status ?? 'DRAFT').toUpperCase()}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:40px;gap:20px">
    <div style="flex:1;background:#1E293B;border-radius:10px;padding:22px;border-left:3px solid ${p}">
      <div style="font-size:9px;color:${p};text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px">From</div>
      <div style="color:#F1F5F9">${fromBlock(inv.from, p)}</div>
    </div>
    <div style="flex:1;background:#1E293B;border-radius:10px;padding:22px;border-left:3px solid ${p}">
      <div style="font-size:9px;color:${p};text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px">Billed To</div>
      <div style="color:#F1F5F9">${toBlock(inv.to, p)}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:32px">
    <thead><tr style="border-bottom:1px solid ${p}55">
      <th style="padding-bottom:14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${descW}">${descLabel}</th>
      ${hasExtra ? `<th style="padding-bottom:14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${extraW}">${extraLabel}</th>` : ''}
      <th style="padding-bottom:14px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${qtyW}">${qtyLabel}</th>
      <th style="padding-bottom:14px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${numW}">${priceLabel}</th>
      <th style="padding-bottom:14px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${numW}">Total</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:32px">
    <div style="min-width:280px">
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#64748B"><span>Subtotal</span><span>${formatCurrency(sub, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#64748B;border-bottom:1px solid #1E293B"><span>VAT (${inv.vatRate ?? 0}%)</span><span>${formatCurrency(vat, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:16px 0 4px;font-size:22px;font-weight:700;color:${p}"><span>TOTAL</span><span>${formatCurrency(total, cur)}</span></div>
    </div>
  </div>
  ${notes ? `<div style="background:#1E293B;border-radius:8px;padding:16px;margin-bottom:20px;font-size:12px;color:#94A3B8"><strong style="color:#CBD5E1">Notes: </strong>${notes}</div>` : ''}
  ${sig}${social}${payHtml}
</div></body></html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildInvoiceHTML(invoice, paymentLink = '') {
  const tpl = getTemplate(invoice.templateId);
  const currency = invoice.currency ?? 'RWF';
  const { subtotal, vatAmount, total } = calcInvoice(invoice.items ?? [], invoice.vatRate);
  const docTitle = invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE';

  // Load logo from file (authoritative source) — avoids AsyncStorage size limits
  const logoSrc = await getBusinessLogo();
  const rows = itemRows(invoice.items, currency);
  const style = tpl.style ?? 'modern';

  const sig = invoice.signature ? `
    <div style="margin-top:36px;padding-top:16px;border-top:1px solid rgba(128,128,128,0.2)">
      <img src="${invoice.signature}" style="max-height:50px;max-width:160px;display:block"/>
      <p style="font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px">Authorized Signature</p>
    </div>` : '';

  const social = buildSocialFooter(invoice.from, tpl.primaryColor, style);

  const payHtml = paymentLink ? `
    <div style="margin-top:28px;padding:18px;border-radius:8px;background:${style === 'dark' ? '#1E293B' : '#F8FAFC'};border:1px solid ${tpl.primaryColor}33">
      <p style="font-weight:700;color:${tpl.primaryColor};margin:0 0 8px">💳 Payment Instructions</p>
      ${invoice.from?.momoNumber ? `<p style="font-size:12px;margin:3px 0;color:${style === 'dark' ? '#CBD5E1' : '#374151'}">MTN MoMo: <strong>${invoice.from.momoNumber}</strong></p>` : ''}
      ${invoice.from?.momoCode   ? `<p style="font-size:12px;margin:3px 0;color:${style === 'dark' ? '#CBD5E1' : '#374151'}">MoMo Code: <strong>${invoice.from.momoCode}</strong></p>` : ''}
      <p style="font-size:11px;color:#94A3B8;margin-top:10px;margin-bottom:4px">Tap to confirm payment:</p>
      <a href="${paymentLink}" style="font-size:11px;color:${tpl.primaryColor};word-break:break-all">${paymentLink}</a>
    </div>` : '';

  const colHeaders = invoice.colHeaders ?? { desc: 'Description', extraLabel: '', qty: 'Qty', price: 'Unit Price' };
  const args = [invoice, tpl, docTitle, logoSrc, rows, currency, subtotal, vatAmount, total, payHtml, invoice.notes ?? '', sig, social, colHeaders];
  if (style === 'modern')  return buildModern(...args);
  if (style === 'classic') return buildClassic(...args);
  if (style === 'minimal') return buildMinimal(...args);
  if (style === 'bold')    return buildBold(...args);
  return buildDark(...args);
}

export async function printInvoice(invoice) {
  const html = await buildInvoiceHTML(invoice);
  await Print.printAsync({ html });
}

export async function shareInvoice(invoice, paymentLink = '') {
  const html = await buildInvoiceHTML(invoice, paymentLink);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing not available on this device');

  const issuerName = safeName(invoice.from?.name);
  const clientName = safeName(invoice.to?.name);
  const invNum = (invoice.number ?? '').replace(/[^a-zA-Z0-9]/g, '') || 'Invoice';
  const dateStr = (invoice.date ?? new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const fileName = `${invNum}_${issuerName}_${clientName}_${dateStr}.pdf`;
  const dialogTitle = `${invoice.number} — ${invoice.to?.name ?? ''}`;
  // Copy into the SAME directory as the expo-print output — no cross-filesystem boundary
  const sourceDir = uri.substring(0, uri.lastIndexOf('/') + 1);
  const dest = sourceDir + fileName;
  try {
    try { await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
    await FileSystem.copyAsync({ from: uri, to: dest });
    await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
    try { await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  } catch {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  }
}
