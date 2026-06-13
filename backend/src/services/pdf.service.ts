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

export interface CheckinReceiptData {
  bookingId: string;
  customerName: string;
  checkInDateTime: Date;
  scheduledCheckOut: Date | null;
  licensePlate: string | null;
  carModel: string | null;
  adults: number | null;
  keepKeys: boolean | null;
  totalPrice: number;
  walleePaid: number;
  checkinPaid: number;
}

function generateCheckinReceiptHtml(data: CheckinReceiptData, company: CompanySettings): string {
  const remaining = parseFloat((data.totalPrice - data.walleePaid - data.checkinPaid).toFixed(2));

  const checkInDateStr = new Date(data.checkInDateTime).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const scheduledCheckOutStr = data.scheduledCheckOut
    ? new Date(data.scheduledCheckOut).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  const phoneLine = company.companyPhone1 && company.companyPhone2
    ? `${company.companyPhone1} | ${company.companyPhone2}`
    : (company.companyPhone1 || company.companyPhone2 || '');

  const vehicleParts = [data.licensePlate, data.carModel].filter(Boolean);
  const vehicleStr = vehicleParts.length > 0 ? vehicleParts.join(' / ') : '—';

  const financialRows = `
    <div class="row small"><span>Total price</span><span>€${data.totalPrice.toFixed(2)}</span></div>
    ${data.walleePaid > 0 ? `<div class="row small"><span>Paid online</span><span>€${data.walleePaid.toFixed(2)}</span></div>` : ''}
    ${data.checkinPaid > 0 ? `<div class="row small"><span>Paid at check-in</span><span>€${data.checkinPaid.toFixed(2)}</span></div>` : ''}
    ${remaining > 0
      ? `<div class="row grand"><span>Balance due at check-out</span><span>€${remaining.toFixed(2)}</span></div>`
      : `<div class="paid-full">&#10003; PAID IN FULL</div>`
    }
  `;

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
    .row { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; }
    .row.small { font-size: 9px; color: #444; }
    .row.grand { font-size: 11px; font-weight: 700; border-top: 1px solid #000; margin-top: 4px; padding-top: 5px; }
    .paid-full { text-align: center; font-size: 11px; font-weight: 700; border-top: 1px solid #000; margin-top: 4px; padding-top: 5px; }
    .info-grid { display: flex; gap: 4mm; }
    .info-cell { flex: 1; }
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
    <div class="bold" style="font-size:12px; letter-spacing:2px;">CHECK-IN RECEIPT</div>
    <div class="meta">${checkInDateStr}</div>
  </div>

  <hr class="divider">

  <div class="label">Customer</div>
  <div class="value">${data.customerName}</div>
  <div class="label">Booking Reference</div>
  <div class="value" style="font-size:8px;">${data.bookingId}</div>

  <hr class="divider">

  <div class="label">Vehicle</div>
  <div class="value">${vehicleStr}</div>
  <div class="info-grid">
    <div class="info-cell">
      <div class="label">Adults</div>
      <div class="value">${data.adults ?? '—'}</div>
    </div>
    <div class="info-cell">
      <div class="label">Keys</div>
      <div class="value">${data.keepKeys ? 'Kept' : 'Returned'}</div>
    </div>
  </div>

  <hr class="divider">

  <div class="label">Scheduled Check-out</div>
  <div class="value">${scheduledCheckOutStr}</div>

  <hr class="divider-solid">

  <div>${financialRows}</div>

  <div class="footer">
    <p>Thank you for choosing Park &amp; Travel.</p>
    ${company.companyVatNo ? `<p>VAT Reg: ${company.companyVatNo}</p>` : ''}
  </div>
</body>
</html>`;
}

export async function generateCheckinReceiptZpl(data: CheckinReceiptData): Promise<string> {
  const company = await getCompanySettings();

  const remaining = parseFloat((data.totalPrice - data.walleePaid - data.checkinPaid).toFixed(2));

  const checkInDateStr = new Date(data.checkInDateTime).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const scheduledCheckOutStr = data.scheduledCheckOut
    ? new Date(data.scheduledCheckOut).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';

  const phoneLine = company.companyPhone1 && company.companyPhone2
    ? `${company.companyPhone1} | ${company.companyPhone2}`
    : company.companyPhone1 || company.companyPhone2 || '';

  const vehicleParts = [data.licensePlate, data.carModel].filter(Boolean);
  const vehicleStr = vehicleParts.length > 0 ? vehicleParts.join(' / ') : '-';

  const PW = 576;
  const LM = 10;
  const BW = PW - LM * 2;
  let y = 80; // ~10mm top margin to clear the paper cutter
  const cmds: string[] = [];

  const esc    = (s: string) => String(s).replace(/[\^~\\]/g, '');
  const center = (text: string, h: number) => cmds.push(`^FO0,${y}^A0N,${h},${h}^FB${PW},1,0,C,0^FD${esc(text)}^FS`);
  const left   = (text: string, h: number) => cmds.push(`^FO${LM},${y}^A0N,${h},${h}^FD${esc(text)}^FS`);
  const right  = (text: string, h: number) => cmds.push(`^FO${LM},${y}^A0N,${h},${h}^FB${BW},1,0,R,0^FD${esc(text)}^FS`);
  const solid  = () => cmds.push(`^FO${LM},${y}^GB${BW},2,2^FS`);
  const thin   = () => cmds.push(`^FO${LM},${y}^GB${BW},1,1^FS`);

  // Header
  center(company.companyName || 'Park & Travel', 30); y += 36;
  if (company.companyVatNo) { center(`VAT: ${company.companyVatNo}`, 20); y += 24; }
  if (phoneLine) { center(`Tel: ${phoneLine}`, 20); y += 24; }
  y += 6; solid(); y += 10;

  // Title
  center('CHECK-IN RECEIPT', 24); y += 30;
  center(checkInDateStr, 20); y += 24;
  y += 6; thin(); y += 10;

  // Customer
  left('CUSTOMER', 15); y += 20;
  left(data.customerName, 22); y += 26;
  left('BOOKING REFERENCE', 15); y += 20;
  left(data.bookingId, 16); y += 22;
  y += 6; thin(); y += 10;

  // Vehicle
  left('VEHICLE', 15); y += 20;
  left(vehicleStr, 22); y += 26;

  // Adults (left) and Keys (right) on same row
  cmds.push(`^FO${LM},${y}^A0N,15,15^FD${esc('ADULTS')}^FS`);
  cmds.push(`^FO${Math.floor(PW / 2)},${y}^A0N,15,15^FD${esc('KEYS')}^FS`);
  y += 20;
  cmds.push(`^FO${LM},${y}^A0N,22,22^FD${esc(String(data.adults ?? '-'))}^FS`);
  cmds.push(`^FO${Math.floor(PW / 2)},${y}^A0N,22,22^FD${esc(data.keepKeys ? 'Kept' : 'Returned')}^FS`);
  y += 26;

  y += 4; thin(); y += 10;

  // Checkout date
  left('SCHEDULED CHECK-OUT', 15); y += 20;
  left(scheduledCheckOutStr, 22); y += 26;
  y += 4; solid(); y += 10;

  // Financials
  left('Total price', 18); right(`€${data.totalPrice.toFixed(2)}`, 18); y += 24;
  if (data.walleePaid > 0) { left('Paid online', 18); right(`€${data.walleePaid.toFixed(2)}`, 18); y += 24; }
  if (data.checkinPaid > 0) { left('Paid at check-in', 18); right(`€${data.checkinPaid.toFixed(2)}`, 18); y += 24; }
  solid(); y += 10;

  if (remaining > 0) {
    left('Balance due at check-out', 26); right(`€${remaining.toFixed(2)}`, 26); y += 34;
  } else {
    center('PAID IN FULL', 26); y += 34;
  }

  // Footer
  y += 10;
  center('Thank you for choosing Park & Travel.', 16); y += 22;
  if (company.companyVatNo) { center(`VAT Reg: ${company.companyVatNo}`, 16); y += 22; }
  y += 20;

  return ['^XA', `^PW${PW}`, `^LL${y}`, '^CI28', ...cmds, '^PQ1', '^XZ'].join('');
}

export async function generateCheckinReceiptPdf(data: CheckinReceiptData): Promise<Buffer> {
  const company = await getCompanySettings();
  const html = generateCheckinReceiptHtml(data, company);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
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

export async function generateThermalReceiptZpl(data: ReceiptPdfData): Promise<string> {
  const company = await getCompanySettings();

  const taxRate = company.tax ?? 0;
  const total = data.totalAmount;
  const net = parseFloat((total / (1 + taxRate / 100)).toFixed(2));
  const vatAmount = parseFloat((total - net).toFixed(2));

  const dateStr = new Date(data.receiptDate).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const phoneLine = company.companyPhone1 && company.companyPhone2
    ? `${company.companyPhone1} | ${company.companyPhone2}`
    : company.companyPhone1 || company.companyPhone2 || '';

  const PW = 576; // ZQ521 @ 203dpi: 72mm printable = 576 dots
  const LM = 10;
  const BW = PW - LM * 2;
  let y = 80; // ~10mm top margin to clear the paper cutter
  const cmds: string[] = [];

  const esc    = (s: string) => String(s).replace(/[\^~\\]/g, '');
  const center = (text: string, h: number) => cmds.push(`^FO0,${y}^A0N,${h},${h}^FB${PW},1,0,C,0^FD${esc(text)}^FS`);
  const left   = (text: string, h: number) => cmds.push(`^FO${LM},${y}^A0N,${h},${h}^FD${esc(text)}^FS`);
  const right  = (text: string, h: number) => cmds.push(`^FO${LM},${y}^A0N,${h},${h}^FB${BW},1,0,R,0^FD${esc(text)}^FS`);
  const solid  = () => cmds.push(`^FO${LM},${y}^GB${BW},2,2^FS`);
  const thin   = () => cmds.push(`^FO${LM},${y}^GB${BW},1,1^FS`);

  // Header
  center(company.companyName || 'Park & Travel', 30); y += 36;
  if (company.companyVatNo) { center(`VAT: ${company.companyVatNo}`, 20); y += 24; }
  if (phoneLine) { center(`Tel: ${phoneLine}`, 20); y += 24; }
  y += 6; solid(); y += 10;

  // Receipt title
  center('RECEIPT', 26); y += 32;
  center(data.receiptNumber, 20); y += 24;
  center(dateStr, 20); y += 24;
  y += 6; thin(); y += 10;

  // Customer
  left('BILLED TO', 15); y += 20;
  left(data.customerName, 22); y += 26;
  left('BOOKING REF', 15); y += 20;
  left(data.bookingId, 16); y += 22;
  y += 6; thin(); y += 10;

  // Line items
  left('DESCRIPTION', 15); right('AMOUNT', 15); y += 20;
  thin(); y += 8;
  for (const line of data.lines) {
    const desc = line.description.length > 34 ? line.description.slice(0, 33) + '.' : line.description;
    left(desc, 20); right(`€${Number(line.amount).toFixed(2)}`, 20); y += 26;
  }
  y += 4; solid(); y += 10;

  // Totals (match HTML exactly)
  left(`Net (excl. VAT ${taxRate}%)`, 18); right(`€${net.toFixed(2)}`, 18); y += 24;
  left(`VAT (${taxRate}%)`, 18); right(`€${vatAmount.toFixed(2)}`, 18); y += 24;
  solid(); y += 10;

  // Grand total
  left('TOTAL PAID', 30); right(`€${total.toFixed(2)}`, 30); y += 38;

  // Footer
  y += 10;
  center('Thank you for choosing Park & Travel.', 16); y += 22;
  if (company.companyVatNo) { center(`VAT Reg: ${company.companyVatNo}`, 16); y += 22; }
  y += 20;

  return ['^XA', `^PW${PW}`, `^LL${y}`, '^CI28', ...cmds, '^PQ1', '^XZ'].join('');
}

export async function generateThermalReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const company = await getCompanySettings();
  const html = generateThermalReceiptHtml(data, company);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
