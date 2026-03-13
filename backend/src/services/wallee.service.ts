import jwt from 'jsonwebtoken';
import axios from 'axios';

const WALLEE_BASE_URL = 'https://app-wallee.com';
const WALLEE_SPACE_ID = 93067;
const WALLEE_SUB = '163504';
const WALLEE_LIMIT = 10;

function buildQueryParam(dateFrom: string, dateTo: string): string {
  return `createdOn:>='${dateFrom}' AND createdOn:<='${dateTo}'`;
}

function buildRequestPath(dateFrom: string, dateTo: string, offset: number): string {
  const query = encodeURIComponent(buildQueryParam(dateFrom, dateTo));
  return `/api/v2.0/payment/transactions/search?limit=${WALLEE_LIMIT}&offset=${offset}&query=${query}`;
}

function generateJWT(requestPath: string): string {
  const secret = Buffer.from(process.env.WALLEE_SECRET!, 'base64');

  const payload = {
    sub: WALLEE_SUB,
    iat: Math.floor(Date.now() / 1000),
    requestPath,
    requestMethod: 'GET',
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    header: {
      alg: 'HS256',
      type: 'JWT',
      ver: 1,
    } as any,
    noTimestamp: true,
  });
}

export async function getWalleeTransactions(
  dateFrom: string,
  dateTo: string,
  offset: number
): Promise<any> {
  const requestPath = buildRequestPath(dateFrom, dateTo, offset);
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
