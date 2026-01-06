import axios from "axios";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "dev-c2p14cvw0yc4psqt.us.auth0.com";
const AUTH0_MANAGEMENT_CLIENT_ID = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
const AUTH0_MANAGEMENT_CLIENT_SECRET = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;

interface Auth0TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0UserMetadata {
  given_name?: string;
  family_name?: string;
  phone_number?: string;
}

interface Auth0User {
  user_id: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  picture?: string;
  user_metadata?: {
    phone_number?: string;
    phone_code?: string;
  };
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getManagementToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!AUTH0_MANAGEMENT_CLIENT_ID || !AUTH0_MANAGEMENT_CLIENT_SECRET) {
    throw new Error("Auth0 Management API credentials not configured");
  }

  const response = await axios.post<Auth0TokenResponse>(
    `https://${AUTH0_DOMAIN}/oauth/token`,
    {
      grant_type: "client_credentials",
      client_id: AUTH0_MANAGEMENT_CLIENT_ID,
      client_secret: AUTH0_MANAGEMENT_CLIENT_SECRET,
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;

  return cachedToken as string;
}

export async function getUserByEmail(email: string): Promise<Auth0User | null> {
  const token = await getManagementToken();

  const response = await axios.get<Auth0User[]>(
    `https://${AUTH0_DOMAIN}/api/v2/users-by-email`,
    {
      params: { email },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.length > 0 ? response.data[0] : null;
}

export async function getUserById(userId: string): Promise<Auth0User | null> {
  const token = await getManagementToken();

  try {
    const response = await axios.get<Auth0User>(
      `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function updateUser(
  userId: string,
  data: { given_name?: string; family_name?: string; name?: string; user_metadata?: { phone_number?: string; phone_code?: string } }
): Promise<Auth0User> {
  const token = await getManagementToken();

  const response = await axios.patch<Auth0User>(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}
