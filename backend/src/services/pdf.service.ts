import { chromium } from 'playwright';
import { prisma } from '../lib/prisma';
import { ReceiptLineInput } from './receipt.service';

interface CompanySettings {
  companyName: string | null;
  companyVatNo: string | null;
  companyPhone1: string | null;
  companyPhone2: string | null;
  tax: number | null;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  receiptDate: Date;
  bookingId: string;
  customerName: string;
  totalAmount: number;
  discount: number | null;
  lines: ReceiptLineInput[];
}

async function getCompanySettings(): Promise<CompanySettings> {
  const settings = await prisma.$queryRawUnsafe<{ id: string; value: string | null }[]>(
    `SELECT id, value FROM configuration_settings WHERE id IN ($1, $2, $3, $4, $5)`,
    'configurationSetting_companyName',
    'configurationSetting_companyVatNo',
    'configurationSetting_companyPhone1',
    'configurationSetting_companyPhone2',
    'configurationSetting_tax'
  );

  const m = new Map<string, string | null>();
  settings.forEach((s) => m.set(s.id, s.value));

  const taxRaw = m.get('configurationSetting_tax');
  return {
    companyName: m.get('configurationSetting_companyName') ?? null,
    companyVatNo: m.get('configurationSetting_companyVatNo') ?? null,
    companyPhone1: m.get('configurationSetting_companyPhone1') ?? null,
    companyPhone2: m.get('configurationSetting_companyPhone2') ?? null,
    tax: taxRaw ? parseFloat(taxRaw) : null,
  };
}

function generateReceiptHtml(data: ReceiptPdfData, company: CompanySettings): string {
  const taxRate = company.tax ?? 0;

  const subtotal = data.totalAmount;
  const discountAmount = data.discount && data.discount > 0
    ? parseFloat((subtotal * data.discount / 100).toFixed(2))
    : 0;
  const grossAfterDiscount = parseFloat((subtotal - discountAmount).toFixed(2));
  const net = parseFloat((grossAfterDiscount / (1 + taxRate / 100)).toFixed(2));
  const vatAmount = parseFloat((grossAfterDiscount - net).toFixed(2));

  const date = new Date(data.receiptDate);
  const dateStr = date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

  const phoneLine = company.companyPhone1 && company.companyPhone2
    ? `${company.companyPhone1} &nbsp;|&nbsp; ${company.companyPhone2}`
    : (company.companyPhone1 || company.companyPhone2 || '');

  const lineRows = data.lines.map((line) => `
    <tr>
      <td>
        <span class="line-type">${line.lineType}</span>
        ${line.description}
      </td>
      <td class="right">${Number(line.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRows = data.discount && data.discount > 0 ? `
    <div class="totals-row">
      <span>Subtotal</span>
      <span>€${subtotal.toFixed(2)}</span>
    </div>
    <div class="totals-row discount">
      <span>Discount (${data.discount}%)</span>
      <span>−€${discountAmount.toFixed(2)}</span>
    </div>
    <div class="totals-row separator">
      <span>After Discount</span>
      <span>€${grossAfterDiscount.toFixed(2)}</span>
    </div>
  ` : '';

  const netSeparatorClass = (!data.discount || data.discount === 0) ? 'totals-row subtle separator' : 'totals-row subtle';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      background: #fff;
      padding: 30px 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .company-name {
      font-size: 20px;
      font-weight: 700;
      color: #006B8F;
      margin-bottom: 6px;
    }
    .company-detail {
      font-size: 10px;
      color: #555;
      margin: 2px 0;
    }
    .receipt-badge { text-align: right; }
    .receipt-badge h2 {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 8px;
    }
    .receipt-meta { font-size: 10px; color: #555; margin: 3px 0; }
    .receipt-meta strong { color: #1a1a1a; }
    .divider { border: none; border-top: 2px solid #006B8F; margin: 20px 0; }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .info-group label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #888;
      display: block;
      margin-bottom: 3px;
    }
    .info-group p { font-size: 11px; font-weight: 600; color: #1a1a1a; }
    .info-group .booking-id {
      font-size: 10px;
      color: #555;
      font-family: monospace;
      font-weight: normal;
      word-break: break-all;
    }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.items thead tr { background-color: #006B8F; }
    table.items thead th {
      padding: 10px 14px;
      text-align: left;
      font-size: 10px;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
    }
    table.items thead th.right { text-align: right; }
    table.items tbody tr { border-bottom: 1px solid #eee; }
    table.items tbody tr:last-child { border-bottom: none; }
    table.items tbody td { padding: 11px 14px; font-size: 11px; color: #333; }
    table.items tbody td.right { text-align: right; }
    .line-type {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 2px;
    }
    .totals-wrapper { display: flex; justify-content: flex-end; }
    .totals { width: 270px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 11px;
      color: #444;
    }
    .totals-row.subtle { color: #666; font-size: 10px; }
    .totals-row.discount { color: #c62828; }
    .totals-row.separator {
      border-top: 1px solid #ddd;
      margin-top: 4px;
      padding-top: 8px;
    }
    .totals-row.grand-total {
      border-top: 2px solid #006B8F;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 14px;
      font-weight: 700;
      color: #006B8F;
    }
    .footer {
      margin-top: 50px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 9px;
      color: #999;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <div class="company-name">${company.companyName || 'Park &amp; Travel'}</div>
      ${company.companyVatNo ? `<p class="company-detail">VAT Registration No: ${company.companyVatNo}</p>` : ''}
      ${phoneLine ? `<p class="company-detail">Tel: ${phoneLine}</p>` : ''}
    </div>
    <div class="receipt-badge">
      <h2>Receipt</h2>
      <p class="receipt-meta">Receipt No: <strong>${data.receiptNumber}</strong></p>
      <p class="receipt-meta">Date: <strong>${dateStr}</strong></p>
    </div>
  </div>

  <hr class="divider">

  <div class="info-section">
    <div class="info-group">
      <label>Billed To</label>
      <p>${data.customerName}</p>
    </div>
    <div class="info-group" style="text-align: right;">
      <label>Booking Reference</label>
      <p class="booking-id">${data.bookingId}</p>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Amount (€)</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <div class="totals-wrapper">
    <div class="totals">
      ${discountRows}
      <div class="${netSeparatorClass}">
        <span>Net Amount (excl. VAT)</span>
        <span>€${net.toFixed(2)}</span>
      </div>
      <div class="totals-row subtle">
        <span>VAT (${taxRate}%)</span>
        <span>€${vatAmount.toFixed(2)}</span>
      </div>
      <div class="totals-row grand-total">
        <span>Total Paid</span>
        <span>€${grossAfterDiscount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>This is an official receipt${company.companyName ? ` issued by ${company.companyName}` : ''}.</p>
    <p>Thank you for choosing Park &amp; Travel.</p>
  </div>
</body>
</html>`;
}

function generateThermalReceiptHtml(data: ReceiptPdfData, company: CompanySettings): string {
  const taxRate = company.tax ?? 0;
  const subtotal = data.totalAmount;
  const net = parseFloat((subtotal / (1 + taxRate / 100)).toFixed(2));
  const vatAmount = parseFloat((subtotal - net).toFixed(2));

  const date = new Date(data.receiptDate);
  const dateStr = date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

  const phoneLine = company.companyPhone1 && company.companyPhone2
    ? `${company.companyPhone1} | ${company.companyPhone2}`
    : (company.companyPhone1 || company.companyPhone2 || '');

  const lineRows = data.lines.map((line) => `
    <tr>
      <td class="desc">${line.description}</td>
      <td class="amt">€${Number(line.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      width: 80mm;
      padding: 6mm 5mm;
    }
    .center { text-align: center; }
    .bold { font-weight: 700; }
    .company-name { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
    .meta { font-size: 9px; color: #333; margin: 1px 0; }
    .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .divider-solid { border: none; border-top: 1px solid #000; margin: 5px 0; }
    .label { font-size: 8px; text-transform: uppercase; color: #555; margin-bottom: 1px; }
    .value { font-size: 10px; font-weight: 600; margin-bottom: 4px; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { font-size: 8px; text-transform: uppercase; border-bottom: 1px solid #000; padding: 3px 0; text-align: left; }
    th.amt, td.amt { text-align: right; }
    td.desc { font-size: 10px; padding: 4px 0; }
    td.amt { font-size: 10px; padding: 4px 0; white-space: nowrap; }
    .totals { margin-top: 2px; }
    .totals-row { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; }
    .totals-row.small { font-size: 9px; color: #444; }
    .totals-row.grand { font-size: 13px; font-weight: 700; border-top: 1px solid #000; margin-top: 4px; padding-top: 5px; }
    .footer { margin-top: 8mm; font-size: 8px; color: #555; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="center">
    <div class="company-name">${company.companyName || 'Park &amp; Travel'}</div>
    ${company.companyVatNo ? `<div class="meta">VAT: ${company.companyVatNo}</div>` : ''}
    ${phoneLine ? `<div class="meta">Tel: ${phoneLine}</div>` : ''}
  </div>

  <hr class="divider-solid">

  <div class="center">
    <div class="bold" style="font-size:12px; letter-spacing:2px;">RECEIPT</div>
    <div class="meta">${data.receiptNumber}</div>
    <div class="meta">${dateStr}</div>
  </div>

  <hr class="divider">

  <div class="label">Billed To</div>
  <div class="value">${data.customerName}</div>
  <div class="label">Booking Ref</div>
  <div class="value" style="font-size:8px;">${data.bookingId}</div>

  <hr class="divider">

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="amt">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <hr class="divider-solid">

  <div class="totals">
    <div class="totals-row small">
      <span>Net (excl. VAT ${taxRate}%)</span>
      <span>€${net.toFixed(2)}</span>
    </div>
    <div class="totals-row small">
      <span>VAT (${taxRate}%)</span>
      <span>€${vatAmount.toFixed(2)}</span>
    </div>
    <div class="totals-row grand">
      <span>TOTAL PAID</span>
      <span>€${subtotal.toFixed(2)}</span>
    </div>
  </div>

  <div class="footer">
    <p>Thank you for choosing Park &amp; Travel.</p>
    ${company.companyVatNo ? `<p>VAT Reg: ${company.companyVatNo}</p>` : ''}
  </div>
</body>
</html>`;
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const company = await getCompanySettings();
  const html = generateReceiptHtml(data, company);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateThermalReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const company = await getCompanySettings();
  const html = generateThermalReceiptHtml(data, company);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ width: '80mm', height: 'auto', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
