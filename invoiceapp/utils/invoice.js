import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getTemplate } from '../constants/templates';
import { getSettings, getBusinessLogo, getStampPhoto } from './storage';

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
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const ext = uri.split('.').pop().toLowerCase().split('?')[0];
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch { return null; }
}

// ─── HTML escaping ────────────────────────────────────────────────────────────
// Escapes characters that have special meaning in HTML so that user-supplied
// strings cannot inject markup or scripts into the invoice WebView.
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    ig   ? `<div style="display:flex;align-items:center;gap:5px">${IG_ICON(primaryColor)}<span style="font-size:11px;color:${primaryColor};font-weight:500">${escHtml(ig)}</span></div>` : '',
    mail ? `<div style="display:flex;align-items:center;gap:5px">${MAIL_ICON(primaryColor)}<span style="font-size:11px;color:${textColor}">${escHtml(mail)}</span></div>` : '',
    web  ? `<div style="display:flex;align-items:center;gap:5px">${WEB_ICON(primaryColor)}<span style="font-size:11px;color:${textColor}">${escHtml(web)}</span></div>` : '',
  ].filter(Boolean).join('');

  return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid ${borderColor};display:flex;gap:20px;flex-wrap:wrap;align-items:center">${items}</div>`;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function itemRows(items, currency) {
  return (items ?? []).map(item => {
    if (item.type === 'section') {
      return { type: 'section', desc: escHtml(item.description), extra: '', qty: '', price: '', total: '' };
    }
    const lineTotal = Math.round((parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0));
    const qty = parseFloat(item.qty) % 1 === 0 ? parseInt(item.qty, 10) : parseFloat(item.qty);
    return { type: 'item', desc: escHtml(item.description), notes: escHtml(item.notes ?? ''), extra: escHtml(item.extra ?? ''), qty, price: formatCurrency(item.unitPrice, currency), total: formatCurrency(lineTotal, currency) };
  });
}

function fromBlock(from, color) {
  return `
    <div style="font-size:14px;font-weight:700;color:inherit">${escHtml(from?.name)}</div>
    ${from?.address ? `<div style="font-size:12px;line-height:1.5;margin-top:3px">${escHtml(from.address).replace(/\n/g,'<br/>')}</div>` : ''}
    ${from?.tin    ? `<div style="font-size:12px;margin-top:2px">TIN: ${escHtml(from.tin)}</div>` : ''}
    ${from?.phone  ? `<div style="font-size:12px">${escHtml(from.phone)}</div>` : ''}
    ${from?.email  ? `<div style="font-size:12px;color:${color}">${escHtml(from.email)}</div>` : ''}`;
}

function toBlock(to, color) {
  return `
    <div style="font-size:14px;font-weight:700;color:inherit">${escHtml(to?.name)}</div>
    ${to?.address ? `<div style="font-size:12px;line-height:1.5;margin-top:3px">${escHtml(to.address).replace(/\n/g,'<br/>')}</div>` : ''}
    ${to?.tin     ? `<div style="font-size:12px;margin-top:2px">TIN: ${escHtml(to.tin)}</div>` : ''}
    ${to?.email   ? `<div style="font-size:12px;color:${color}">${escHtml(to.email)}</div>` : ''}`;
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
      return `<tr><td colspan="${colCount}" style="padding:5px 12px;font-size:12px;font-weight:700;color:${p};background:${lc}88">${r.desc}</td></tr>`;
    }
    return `
    <tr style="background:${i % 2 === 0 ? '#fff' : lc + '55'}">
      <td style="padding:6px 12px;font-size:12px">${r.desc}${r.notes ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:6px 12px;font-size:12px">${r.extra}</td>` : ''}
      <td style="padding:6px 12px;text-align:center;font-size:12px">${r.qty}</td>
      <td style="padding:6px 12px;text-align:right;font-size:12px">${r.price}</td>
      <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#1E293B">
<div style="max-width:800px;margin:0 auto;padding:22px 28px;background:#F1F5F9">
  <div style="background:${p};border-radius:16px;padding:20px 26px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" style="height:80px;max-width:200px;object-fit:contain;object-position:left;display:block;border-radius:8px;margin-bottom:10px"/>` : ''}
      <div style="font-size:26px;font-weight:900;color:${ht};letter-spacing:-0.5px">${docTitle}</div>
    </div>
    <div style="text-align:right;color:${ht}">
      <div style="font-size:18px;font-weight:700">${inv.number}</div>
      <div style="opacity:0.8;margin-top:4px;font-size:12px">${formatDate(inv.date)}</div>
      ${inv.dueDate ? `<div style="opacity:0.7;font-size:11px">Due ${formatDate(inv.dueDate)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;gap:12px;margin-bottom:12px">
    <div style="flex:1;background:#fff;border-radius:12px;padding:14px 16px;color:#1E293B">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${p};margin-bottom:6px">From</div>
      ${fromBlock(inv.from, p)}
    </div>
    <div style="flex:1;background:#fff;border-radius:12px;padding:14px 16px;color:#1E293B">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${p};margin-bottom:6px">Billed To</div>
      ${toBlock(inv.to, p)}
    </div>
  </div>
  <div style="background:#fff;border-radius:12px;overflow:hidden;margin-bottom:12px">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <thead><tr style="background:${lc}">
        <th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${descW}">${descLabel}</th>
        ${hasExtra ? `<th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${extraW}">${extraLabel}</th>` : ''}
        <th style="padding:7px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${qtyW}">${qtyLabel}</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${numW}">${priceLabel}</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};width:${numW}">Total</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
  </div>
  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <div style="background:#fff;border-radius:12px;padding:12px 18px;min-width:260px">
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748B"><span>Subtotal</span><span>${formatCurrency(sub, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748B;border-bottom:1px solid #E2E8F0"><span>VAT (${inv.vatRate ?? 0}%)</span><span>${formatCurrency(vat, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 2px;font-size:17px;font-weight:800;color:${p}"><span>TOTAL</span><span>${formatCurrency(total, cur)}</span></div>
    </div>
  </div>
  ${notes ? `<div style="background:#fff;border-radius:12px;padding:10px 14px;margin-bottom:10px;font-size:12px;color:#64748B"><strong style="color:#1E293B">Notes: </strong>${notes}</div>` : ''}
  ${payHtml}${social}
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
      return `<tr><td colspan="${colCount}" style="padding:5px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    return `
    <tr style="${i % 2 !== 0 ? `background:${lc}44` : ''}">
      <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-size:12px">${r.desc}${r.notes ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-size:12px">${r.extra}</td>` : ''}
      <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;text-align:center;font-size:12px">${r.qty}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;text-align:right;font-size:12px">${r.price}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;text-align:right;font-size:12px;font-weight:600">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
  <div style="height:8px;background:${p}"></div>
  <div style="max-width:800px;margin:0 auto;padding:22px 28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid ${p};margin-bottom:14px">
      <div>
        ${logoSrc ? `<img src="${logoSrc}" style="height:80px;max-width:200px;object-fit:contain;object-position:left;display:block;border-radius:8px;margin-bottom:10px"/>` : ''}
        <div style="font-size:24px;font-weight:700;color:${p};font-family:Helvetica,Arial,sans-serif">${docTitle}</div>
      </div>
      <div style="text-align:right;font-family:Helvetica,Arial,sans-serif">
        <div style="font-size:20px;font-weight:700">${inv.number}</div>
        <div style="color:#666;margin-top:3px;font-size:12px">${formatDate(inv.date)}</div>
        ${inv.dueDate ? `<div style="color:#666;font-size:11px">Due: ${formatDate(inv.dueDate)}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-family:Helvetica,Arial,sans-serif">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${p};border-bottom:1px solid ${p};padding-bottom:2px;margin-bottom:7px">From</div>
        ${fromBlock(inv.from, p)}
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${p};border-bottom:1px solid ${p};padding-bottom:2px;margin-bottom:7px">Bill To</div>
        ${toBlock(inv.to, p)}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:Helvetica,Arial,sans-serif;margin-bottom:12px">
      <thead><tr style="background:${p}">
        <th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${descW}">${descLabel}</th>
        ${hasExtra ? `<th style="padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${extraW}">${extraLabel}</th>` : ''}
        <th style="padding:7px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${qtyW}">${qtyLabel}</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${numW}">${priceLabel}</th>
        <th style="padding:7px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${ht};width:${numW}">Total</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <table style="width:260px;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:12px">
        <tr><td style="padding:4px 0;color:#666">Subtotal</td><td style="padding:4px 0;text-align:right">${formatCurrency(sub, cur)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">VAT (${inv.vatRate ?? 0}%)</td><td style="padding:4px 0;text-align:right">${formatCurrency(vat, cur)}</td></tr>
        <tr style="border-top:2px solid ${p}">
          <td style="padding:8px 0;font-weight:700;font-size:15px;color:${p}">TOTAL</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;font-size:15px;color:${p}">${formatCurrency(total, cur)}</td>
        </tr>
      </table>
    </div>
    ${notes ? `<p style="font-size:12px;color:#666;font-family:Helvetica,Arial,sans-serif;margin:0 0 10px"><strong style="color:#1a1a1a">Notes: </strong>${notes}</p>` : ''}
    ${payHtml}${social}
  </div>
  <div style="height:5px;background:${p};margin-top:20px"></div>
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
      return `<tr><td colspan="${colCount}" style="padding:5px 0;border-bottom:1px solid #F1F5F9;font-size:12px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    return `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:12px">${r.desc}${r.notes ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:12px">${r.extra}</td>` : ''}
      <td style="padding:7px 0;border-bottom:1px solid #F1F5F9;text-align:center;font-size:12px">${r.qty}</td>
      <td style="padding:7px 0;border-bottom:1px solid #F1F5F9;text-align:right;font-size:12px">${r.price}</td>
      <td style="padding:7px 0;border-bottom:1px solid #F1F5F9;text-align:right;font-size:12px;font-weight:600">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:720px;margin:0 auto;padding:32px 40px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:16px;border-bottom:1px solid #E5E7EB;margin-bottom:24px">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" style="height:76px;max-width:190px;object-fit:contain;object-position:left;display:block;border-radius:8px;margin-bottom:12px"/>` : ''}
      <div style="font-size:10px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:${p}">${docTitle}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:300;letter-spacing:-0.5px">${inv.number}</div>
      <div style="font-size:12px;color:#9CA3AF;margin-top:4px">${formatDate(inv.date)}</div>
      ${inv.dueDate ? `<div style="font-size:11px;color:#9CA3AF">Due ${formatDate(inv.dueDate)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;gap:40px;margin-bottom:24px">
    <div style="flex:1">
      <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#9CA3AF;margin-bottom:8px">From</div>
      ${fromBlock(inv.from, p)}
    </div>
    <div style="flex:1">
      <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:#9CA3AF;margin-bottom:8px">Billed To</div>
      ${toBlock(inv.to, p)}
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:20px">
    <thead><tr style="border-bottom:1px solid #E5E7EB">
      <th style="padding-bottom:8px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${descW}">${descLabel}</th>
      ${hasExtra ? `<th style="padding-bottom:8px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${extraW}">${extraLabel}</th>` : ''}
      <th style="padding-bottom:8px;text-align:center;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${qtyW}">${qtyLabel}</th>
      <th style="padding-bottom:8px;text-align:right;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${numW}">${priceLabel}</th>
      <th style="padding-bottom:8px;text-align:right;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;width:${numW}">Total</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
    <div style="text-align:right">
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:4px">Subtotal: ${formatCurrency(sub, cur)} &nbsp;|&nbsp; VAT ${inv.vatRate ?? 0}%: ${formatCurrency(vat, cur)}</div>
      <div style="border-top:2px solid ${p};padding-top:10px;margin-top:6px">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9CA3AF;margin-bottom:4px">Total Due</div>
        <div style="font-size:32px;font-weight:200;color:${p};letter-spacing:-1px">${formatCurrency(total, cur)}</div>
      </div>
    </div>
  </div>
  ${notes ? `<p style="font-size:12px;color:#6B7280;border-top:1px solid #F1F5F9;padding-top:12px;margin:0 0 10px"><em><strong>Notes: </strong>${notes}</em></p>` : ''}
  ${payHtml}${social}
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
      return `<tr><td colspan="${colCount}" style="padding:5px 14px;font-size:12px;font-weight:700;color:${p};background:${lc}88">${r.desc}</td></tr>`;
    }
    return `
    <tr style="${i % 2 !== 0 ? `background:${lc}77` : ''}">
      <td style="padding:6px 14px;font-size:12px">${r.desc}${r.notes ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:6px 14px;font-size:12px">${r.extra}</td>` : ''}
      <td style="padding:6px 14px;text-align:center;font-size:12px">${r.qty}</td>
      <td style="padding:6px 14px;text-align:right;font-size:12px">${r.price}</td>
      <td style="padding:6px 14px;text-align:right;font-size:12px;font-weight:700">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#1E293B">
  <div style="background:${p};padding:28px 40px 24px">
    <div style="font-size:40px;font-weight:900;color:${ht};line-height:1;text-transform:uppercase;letter-spacing:-1px">${docTitle}</div>
    <div style="color:${ht};opacity:0.75;font-size:14px;font-weight:300;margin-top:6px;letter-spacing:1px">${inv.number}</div>
    ${logoSrc ? `<img src="${logoSrc}" style="height:72px;max-width:180px;object-fit:contain;object-position:left;display:block;border-radius:6px;margin-top:14px"/>` : ''}
  </div>
  <div style="background:${lc};padding:10px 40px;display:flex;gap:36px">
    <div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${dc};margin-bottom:2px">Date</div><div style="font-weight:700;color:${dc};font-size:13px">${formatDate(inv.date)}</div></div>
    ${inv.dueDate ? `<div><div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${dc};margin-bottom:2px">Due</div><div style="font-weight:700;color:${dc};font-size:13px">${formatDate(inv.dueDate)}</div></div>` : ''}
  </div>
  <div style="padding:24px 40px">
    <div style="display:flex;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#94A3B8;margin-bottom:7px">From</div>
        ${fromBlock(inv.from, p)}
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#94A3B8;margin-bottom:7px">Billed To</div>
        ${toBlock(inv.to, p)}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:14px">
      <thead><tr style="background:${dc}">
        <th style="padding:7px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${descW}">${descLabel}</th>
        ${hasExtra ? `<th style="padding:7px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${extraW}">${extraLabel}</th>` : ''}
        <th style="padding:7px 14px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${qtyW}">${qtyLabel}</th>
        <th style="padding:7px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${numW}">${priceLabel}</th>
        <th style="padding:7px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;width:${numW}">Total</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <table style="width:240px;border-collapse:collapse;font-size:12px">
        <tr><td style="padding:4px 0;color:#64748B">Subtotal</td><td style="padding:4px 0;text-align:right">${formatCurrency(sub, cur)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748B">VAT (${inv.vatRate ?? 0}%)</td><td style="padding:4px 0;text-align:right">${formatCurrency(vat, cur)}</td></tr>
      </table>
    </div>
    <div style="background:${p};border-radius:10px;padding:16px 22px;text-align:right;margin-bottom:16px">
      <div style="color:${ht};opacity:0.75;font-size:10px;text-transform:uppercase;letter-spacing:2px">Total Amount Due</div>
      <div style="color:${ht};font-size:30px;font-weight:900;letter-spacing:-1px;margin-top:2px">${formatCurrency(total, cur)}</div>
    </div>
    ${notes ? `<p style="font-size:12px;color:#64748B;margin:0 0 10px"><strong style="color:#1E293B">Notes: </strong>${notes}</p>` : ''}
    ${payHtml}${social}
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
      return `<tr><td colspan="${colCount}" style="padding:5px 0;border-bottom:1px solid #1E293B;font-size:12px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    return `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #1E293B;font-size:12px;color:#CBD5E1">${r.desc}${r.notes ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:7px 0;border-bottom:1px solid #1E293B;font-size:12px;color:#CBD5E1">${r.extra}</td>` : ''}
      <td style="padding:7px 0;border-bottom:1px solid #1E293B;text-align:center;font-size:12px;color:#CBD5E1">${r.qty}</td>
      <td style="padding:7px 0;border-bottom:1px solid #1E293B;text-align:right;font-size:12px;color:#CBD5E1">${r.price}</td>
      <td style="padding:7px 0;border-bottom:1px solid #1E293B;text-align:right;font-size:12px;font-weight:600;color:#F1F5F9">${r.total}</td>
    </tr>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="img-src 'self' data: blob:;"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#CBD5E1">
<div style="max-width:800px;margin:0 auto;padding:28px 32px;background:#0F172A">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:1px solid ${p}44;margin-bottom:18px">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" style="height:76px;max-width:190px;object-fit:contain;object-position:left;display:block;border-radius:6px;margin-bottom:10px"/>` : ''}
      <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${p};font-weight:700">${docTitle}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:20px;font-weight:700;color:#F1F5F9">${inv.number}</div>
      <div style="color:#475569;font-size:12px;margin-top:4px">${formatDate(inv.date)}</div>
      ${inv.dueDate ? `<div style="color:#475569;font-size:11px">Due: ${formatDate(inv.dueDate)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:18px;gap:14px">
    <div style="flex:1;background:#1E293B;border-radius:10px;padding:14px 16px;border-left:3px solid ${p}">
      <div style="font-size:9px;color:${p};text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:7px">From</div>
      <div style="color:#F1F5F9">${fromBlock(inv.from, p)}</div>
    </div>
    <div style="flex:1;background:#1E293B;border-radius:10px;padding:14px 16px;border-left:3px solid ${p}">
      <div style="font-size:9px;color:${p};text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:7px">Billed To</div>
      <div style="color:#F1F5F9">${toBlock(inv.to, p)}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:16px">
    <thead><tr style="border-bottom:1px solid ${p}55">
      <th style="padding-bottom:8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${descW}">${descLabel}</th>
      ${hasExtra ? `<th style="padding-bottom:8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${extraW}">${extraLabel}</th>` : ''}
      <th style="padding-bottom:8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${qtyW}">${qtyLabel}</th>
      <th style="padding-bottom:8px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${numW}">${priceLabel}</th>
      <th style="padding-bottom:8px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;width:${numW}">Total</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <div style="min-width:260px">
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748B"><span>Subtotal</span><span>${formatCurrency(sub, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748B;border-bottom:1px solid #1E293B"><span>VAT (${inv.vatRate ?? 0}%)</span><span>${formatCurrency(vat, cur)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:10px 0 2px;font-size:20px;font-weight:700;color:${p}"><span>TOTAL</span><span>${formatCurrency(total, cur)}</span></div>
    </div>
  </div>
  ${notes ? `<div style="background:#1E293B;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#94A3B8"><strong style="color:#CBD5E1">Notes: </strong>${notes}</div>` : ''}
  ${payHtml}${social}
</div></body></html>`;
}

// ─── Page-2 continuation ─────────────────────────────────────────────────────
// Produces a second-page div (page-break-before:always) for invoices with >8
// items. Matches the template style and repeats the sig/stamp footer.

function buildPage2(rows2, tpl, colHeaders, cur, payHtml, social, style, invNumber) {
  const { primaryColor: p, lightColor: lc, darkColor: dc } = tpl;
  const ch = colHeaders ?? {};
  const descLabel  = ch.desc || 'Description';
  const qtyLabel   = ch.qty  || 'Qty';
  const priceLabel = ch.price || 'Unit Price';
  const extraLabel = ch.extraLabel || '';
  const hasExtra   = !!extraLabel;
  const colCount   = hasExtra ? 5 : 4;
  const descW = hasExtra ? '35%' : '44%';
  const extraW = '14%';
  const qtyW  = hasExtra ? '7%' : '8%';
  const numW  = hasExtra ? '22%' : '24%';

  const isDark    = style === 'dark';
  const isBold    = style === 'bold';
  const isMinimal = style === 'minimal';
  const isClassic = style === 'classic';

  const bgColor    = isDark ? '#0F172A' : '#fff';
  const textColor  = isDark ? '#CBD5E1' : '#1E293B';
  const fontFamily = isClassic ? "Georgia,'Times New Roman',serif" : (isMinimal ? '-apple-system,Helvetica,Arial,sans-serif' : 'Helvetica,Arial,sans-serif');
  const padding    = isMinimal ? '32px 40px' : isBold ? '24px 40px' : '22px 28px';

  const trs = rows2.map((r, i) => {
    if (r.type === 'section') {
      const bg = (isDark || isMinimal) ? '' : `background:${lc}88;`;
      const border = isDark ? 'border-bottom:1px solid #1E293B;' : isMinimal ? 'border-bottom:1px solid #F1F5F9;' : isClassic ? 'border-bottom:1px solid #E2E8F0;' : '';
      return `<tr><td colspan="${colCount}" style="padding:5px ${isDark || isMinimal ? '0' : '12px'};${border}${bg}font-size:12px;font-weight:700;color:${p}">${r.desc}</td></tr>`;
    }
    const cellPad  = isDark || isMinimal ? '7px 0' : isBold ? '6px 14px' : '6px 12px';
    const border   = isDark ? 'border-bottom:1px solid #1E293B;' : isMinimal ? 'border-bottom:1px solid #F1F5F9;' : isClassic ? 'border-bottom:1px solid #E2E8F0;' : '';
    const rowBg    = isBold && i % 2 !== 0 ? `background:${lc}77` : (!isBold && !isDark && !isMinimal && i % 2 !== 0) ? `background:${lc}55` : '';
    const cellClr  = isDark ? 'color:#CBD5E1;' : '';
    const totalClr = isDark ? 'color:#F1F5F9;' : '';
    return `
    <tr style="${rowBg}">
      <td style="padding:${cellPad};${border}font-size:12px;${cellClr}">${r.desc}${r.notes ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;font-style:italic">${r.notes}</div>` : ''}</td>
      ${hasExtra ? `<td style="padding:${cellPad};${border}font-size:12px;${cellClr}">${r.extra}</td>` : ''}
      <td style="padding:${cellPad};${border}text-align:center;font-size:12px;${cellClr}">${r.qty}</td>
      <td style="padding:${cellPad};${border}text-align:right;font-size:12px;${cellClr}">${r.price}</td>
      <td style="padding:${cellPad};${border}text-align:right;font-size:12px;font-weight:600;${totalClr}">${r.total}</td>
    </tr>`;
  }).join('');

  let thRowStyle, thStyle;
  if (isDark) {
    thRowStyle = `border-bottom:1px solid ${p}55`;
    thStyle    = `padding-bottom:8px;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:${p};font-weight:700;`;
  } else if (isMinimal) {
    thRowStyle = 'border-bottom:1px solid #E5E7EB';
    thStyle    = 'padding-bottom:8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9CA3AF;font-weight:500;';
  } else if (isBold) {
    thRowStyle = `background:${dc}`;
    thStyle    = `padding:7px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;`;
  } else if (isClassic) {
    thRowStyle = `background:${p}`;
    thStyle    = `padding:7px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#fff;`;
  } else {
    thRowStyle = `background:${lc}`;
    thStyle    = `padding:7px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${dc};`;
  }

  const contLabel  = `${escHtml(invNumber)} — Continued`;
  const borderClr  = isDark ? `${p}33` : '#E5E7EB';
  const contStyle  = `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${p}`;

  return `<div style="page-break-before:always;background:${bgColor};font-family:${fontFamily};color:${textColor};padding:${padding}">
  <div style="margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid ${borderClr}">
    <span style="${contStyle}">${contLabel}</span>
  </div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:20px">
    <thead><tr style="${thRowStyle}">
      <th style="${thStyle}text-align:left;width:${descW}">${descLabel}</th>
      ${hasExtra ? `<th style="${thStyle}text-align:left;width:${extraW}">${extraLabel}</th>` : ''}
      <th style="${thStyle}text-align:center;width:${qtyW}">${qtyLabel}</th>
      <th style="${thStyle}text-align:right;width:${numW}">${priceLabel}</th>
      <th style="${thStyle}text-align:right;width:${numW}">Total</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>
  ${payHtml}
  ${social}
</div>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildInvoiceHTML(invoice, _paymentLink = '') {
  const tpl = getTemplate(invoice.templateId);
  const currency = invoice.currency ?? 'RWF';
  const { subtotal, vatAmount, total } = calcInvoice(invoice.items ?? [], invoice.vatRate);
  const docTitle = invoice.docTitle || (invoice.type === 'proforma' ? 'PROFORMA INVOICE' : 'INVOICE');

  const logoSrc = invoice.noLogo ? null : await getBusinessLogo();
  const stampSrc = await getStampPhoto();
  const ITEMS_PER_PAGE = 8;
  const allRows = itemRows(invoice.items, currency);
  const isMultiPage = allRows.length > ITEMS_PER_PAGE;
  const rows  = isMultiPage ? allRows.slice(0, ITEMS_PER_PAGE) : allRows;
  const rows2 = isMultiPage ? allRows.slice(ITEMS_PER_PAGE) : [];
  const style = tpl.style ?? 'modern';

  const social = buildSocialFooter(invoice.from, tpl.primaryColor, style);

  const sigBlock = invoice.signature
    ? `<div>
        <img src="${invoice.signature}" style="max-height:50px;max-width:150px;display:block"/>
        <p style="font-size:9px;color:#94A3B8;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px">Authorized Signature</p>
       </div>`
    : '<div></div>';

  const stampBlock = stampSrc
    ? `<div style="text-align:center">
        <img src="${stampSrc}" style="max-height:230px;max-width:250px;display:block;object-fit:contain"/>
       </div>`
    : '';

  const payHtml = (invoice.signature || stampSrc)
    ? `<div style="margin-top:18px;padding-top:10px;border-top:1px solid rgba(128,128,128,0.2);display:flex;justify-content:space-between;align-items:flex-end">
        ${sigBlock}${stampBlock}
       </div>`
    : '';

  const sig = '';

  const colHeaders = invoice.colHeaders ?? { desc: 'Description', extraLabel: '', qty: 'Qty', price: 'Unit Price' };
  // Escape all user-controlled scalar fields before they enter HTML template strings.
  const safeDocTitle = escHtml(docTitle);
  const safeNotes    = escHtml(invoice.notes ?? '');
  const safeNumber   = escHtml(invoice.number ?? '');
  const safeStatus   = escHtml(invoice.status ?? 'draft');
  const safeInv      = { ...invoice, number: safeNumber, status: safeStatus };
  const args = [safeInv, tpl, safeDocTitle, logoSrc, rows, currency, subtotal, vatAmount, total, payHtml, safeNotes, sig, social, colHeaders];
  let html;
  if (style === 'modern')       html = buildModern(...args);
  else if (style === 'classic') html = buildClassic(...args);
  else if (style === 'minimal') html = buildMinimal(...args);
  else if (style === 'bold')    html = buildBold(...args);
  else                          html = buildDark(...args);

  // Append page 2 continuation when there are more than ITEMS_PER_PAGE rows.
  if (isMultiPage) {
    const page2 = buildPage2(rows2, tpl, colHeaders, currency, payHtml, social, style, safeNumber);
    html = html.replace('</body></html>', page2 + '</body></html>');
  }

  // no injected print CSS needed

  return html;
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

  const clientName = safeName(invoice.to?.name);
  const invNum = (invoice.number ?? '').replace(/[^a-zA-Z0-9-]/g, '') || 'Invoice';
  const dateStr = (invoice.date ?? new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const fileName = `${clientName}_${invNum}_${dateStr}.pdf`;
  const dialogTitle = `${invoice.number} — ${invoice.to?.name ?? ''}`;
  // Try to copy to a named file so the sharing dialog shows a readable filename.
  // Use cacheDirectory — same filesystem as expo-print's temp output.
  const dest = FileSystem.cacheDirectory + fileName;
  try {
    try { await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
    await FileSystem.copyAsync({ from: uri, to: dest });
    await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
    try { await FileSystem.deleteAsync(dest, { idempotent: true }); } catch {}
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  } catch {
    // Fallback: share the original temp file
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  }
}
