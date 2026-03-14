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
  const raw = `createdOn:>='${dateFrom}T00:00:00' AND createdOn:<='${dateTo}T23:59:59'`;
  return encodeURIComponent(raw)
    .replace(/%20/g, '+')
    .replace(/'/g, '%27');
}

function buildRequestPath(dateFrom: string, dateTo: string, offset: number): string {
  const encodedQuery = buildEncodedQuery(dateFrom, dateTo);
  return `/api/v2.0/payment/transactions/search?limit=${WALLEE_LIMIT}&offset=${offset}&query=${encodedQuery}`;
}

function generateJWT(requestPath: string): string {
  const secret = Buffer.from(process.env.WALLEE_SECRET!, 'base64');

  const header = { alg: 'HS256', type: 'JWT', ver: 1 };
  const payload = {
    sub: WALLEE_SUB,
    iat: Math.floor(Date.now() / 1000),
    requestPath,
    requestMethod: 'GET',
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
