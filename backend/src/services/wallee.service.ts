import * as crypto from 'crypto';
import axios from 'axios';

const WALLEE_BASE_URL = process.env.WALLEE_BASE_URL;
const WALLEE_SPACE_ID = process.env.WALLEE_SPACE_ID;
const WALLEE_SUB = process.env.WALLEE_APPLICATION_USER_ID;
const WALLEE_LIMIT = 10;

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function buildEncodedQuery(dateFrom: string, dateTo: string): string {
  const raw = `createdOn:>='${dateFrom}' AND createdOn:<='${dateTo}'`;
  return encodeURIComponent(raw)
    .replace(/%20/g, '+')
    .replace(/'/g, '%27');
}

function buildRequestPath(dateFrom: string, dateTo: string, offset: number): string {
  const encodedQuery = buildEncodedQuery(dateFrom, dateTo);
  return `/api/v2.0/payment/transactions/search?limit=${WALLEE_LIMIT}&offset=${offset}&query=${encodedQuery}`;
}

function generateJWT(requestPath: string, method: 'GET' | 'POST' = 'GET'): string {
  const secret = Buffer.from(process.env.WALLEE_SECRET!, 'base64');

  const header = { alg: 'HS256', type: 'JWT', ver: 1 };
  const payload = {
    sub: WALLEE_SUB,
    iat: Math.floor(Date.now() / 1000),
    requestPath,
    requestMethod: method,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64urlEncode(signature)}`;
}

export async function getWalleeTransactions(
  dateFrom: string,
  dateTo: string,
  offset: number
): Promise<any> {
  const requestPath = buildRequestPath(dateFrom, dateTo, offset);
  const token = generateJWT(requestPath);
  const url = `${WALLEE_BASE_URL}${requestPath}`;

  console.log('Wallee requestPath:', requestPath);

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Space: WALLEE_SPACE_ID,
    },
  });

  return response.data;
}

export async function createWalleeTransaction(params: {
  merchantReference: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  fullName?: string;
  description: string;
  successUrl: string;
  failedUrl: string;
  plateNo?: string;
  carBrand?: string;
}): Promise<number> {
  const requestPath = `/api/v2.0/payment/transactions`;
  const token = generateJWT(requestPath, 'POST');
  const url = `${WALLEE_BASE_URL}${requestPath}`;

  const nameParts = (params.fullName || '').trim().split(' ');
  const givenName = nameParts[0] || 'Customer';
  const familyName = nameParts.slice(1).join(' ') || givenName;

  const metaData: Record<string, string> = {
    bookingReference: params.merchantReference,
  };
  if (params.fullName) metaData['customerName'] = params.fullName;
  if (params.customerEmail) metaData['customerEmail'] = params.customerEmail;
  if (params.plateNo) metaData['plateNo'] = params.plateNo;
  if (params.carBrand) metaData['carBrand'] = params.carBrand;

  const body: any = {
    currency: params.currency,
    merchantReference: params.merchantReference,
    successUrl: params.successUrl,
    failedUrl: params.failedUrl,
    metaData,
    lineItems: [
      {
        name: params.description,
        uniqueId: 'parking-reservation',
        type: 'PRODUCT',
        quantity: '1',
        amountIncludingTax: params.amount.toFixed(2),
        shippingRequired: false,
      },
    ],
  };

  if (params.customerEmail || params.fullName) {
    body.billingAddress = {
      emailAddress: params.customerEmail || '',
      givenName,
      familyName,
    };
  }

  console.log('Creating Wallee transaction URL:', url, 'merchantReference:', params.merchantReference);

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      Space: WALLEE_SPACE_ID,
      'Content-Type': 'application/json',
    },
  });

  console.log('Wallee transaction created, id:', response.data.id);
  return response.data.id;
}

export async function buildPaymentPageUrl(transactionId: number): Promise<string> {
  const requestPath = `/api/v2.0/payment/transactions/${transactionId}/payment-page-url`;
  const token = generateJWT(requestPath);
  const url = `${WALLEE_BASE_URL}${requestPath}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Space: WALLEE_SPACE_ID,
    },
  });

  return response.data;
}

export async function getWalleeTransactionById(transactionId: number): Promise<any> {
  const requestPath = `/api/v2.0/payment/transactions/${transactionId}`;
  const token = generateJWT(requestPath);
  const url = `${WALLEE_BASE_URL}${requestPath}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Space: WALLEE_SPACE_ID,
    },
  });

  return response.data;
}

export async function searchWalleeTransactionsByMerchantRef(merchantReference: string): Promise<any[]> {
  const encodedRef = encodeURIComponent(`merchantReference:'${merchantReference}'`).replace(/'/g, '%27');
  const requestPath = `/api/v2.0/payment/transactions/search?limit=10&offset=0&query=${encodedRef}`;
  const token = generateJWT(requestPath, 'GET');
  const url = `${WALLEE_BASE_URL}${requestPath}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Space: WALLEE_SPACE_ID,
    },
  });

  return Array.isArray(response.data) ? response.data : [];
}
