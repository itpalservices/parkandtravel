import axios from "axios";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
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
  blocked?: boolean;
  user_metadata?: {
    phone_number?: string;
    phone_code?: string;
    name?: string;
    surname?: string;
  };
  app_metadata?: {
    role?: string;
    discount_percentage?: number | null;
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

export async function sendVerificationEmail(userId: string): Promise<void> {
  const token = await getManagementToken();

  await axios.post(
    `https://${AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
    {
      user_id: userId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

interface Auth0Role {
  id: string;
  name: string;
  description?: string;
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const token = await getManagementToken();

  try {
    const response = await axios.get<Auth0Role[]>(
      `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.map((role) => role.name.toLowerCase());
  } catch (error: any) {
    console.error("Error fetching user roles:", error.response?.data || error.message);
    return [];
  }
}

export async function getAllRegularUsers(): Promise<{
  userId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
}[]> {
  const token = await getManagementToken();
  const allUsers: Auth0User[] = [];
  let page = 0;
  const perPage = 100;
  const maxPages = 10; // Limit to prevent rate limiting issues

  try {
    while (page < maxPages) {
      const response = await axios.get<Auth0User[]>(
        `https://${AUTH0_DOMAIN}/api/v2/users`,
        {
          params: {
            page,
            per_page: perPage,
            include_totals: false,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      allUsers.push(...response.data);
      
      if (response.data.length < perPage) {
        break;
      }
      page++;
    }
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.error("Auth0 rate limit reached, returning partial results");
    } else {
      throw error;
    }
  }

  // Filter to only regular users - exclude admin and driver roles from app_metadata
  // Users with no role, role="user", or any other role that's not admin/driver are considered regular users
  const regularUsers = allUsers.filter(user => {
    const role = user.app_metadata?.role?.toLowerCase();
    return role !== "admin" && role !== "driver";
  });

  return regularUsers.map(user => ({
    userId: user.user_id,
    email: user.email,
    name: user.given_name || "",
    surname: user.family_name || "",
    phone: user.user_metadata?.phone_number || "",
    phoneCode: user.user_metadata?.phone_code || "",
  }));
}

interface UserSearchResult {
  found: boolean;
  userId?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  phoneCode?: string;
}

function formatUserResult(user: Auth0User): UserSearchResult {
  const fullName = user.name || 
    [user.given_name, user.family_name].filter(Boolean).join(" ") || 
    "";

  return {
    found: true,
    userId: user.user_id,
    email: user.email,
    fullName,
    phone: user.user_metadata?.phone_number || "",
    phoneCode: user.user_metadata?.phone_code || "",
  };
}

export async function searchRegularUserByEmail(email: string): Promise<UserSearchResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    return { found: false };
  }

  const userRole = user.app_metadata?.role?.toLowerCase();
  if (userRole === "admin" || userRole === "driver") {
    return { found: false };
  }

  return formatUserResult(user);
}

export async function searchRegularUserByPhone(phone: string, phoneCode: string): Promise<UserSearchResult> {
  const token = await getManagementToken();

  const q = `user_metadata.phone_number:"${phone}" AND user_metadata.phone_code:"${phoneCode}"`;
  
  const response = await axios.get<Auth0User[]>(
    `https://${AUTH0_DOMAIN}/api/v2/users`,
    {
      params: {
        q,
        search_engine: 'v3',
        per_page: 10,
        include_totals: false,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const regularUser = response.data.find(user => {
    const role = user.app_metadata?.role?.toLowerCase();
    return role !== "admin" && role !== "driver";
  });

  if (!regularUser) {
    return { found: false };
  }

  return formatUserResult(regularUser);
}

export async function updateDriverUser(
  userId: string,
  params: { name: string; surname: string; phone: string; phoneCode: string }
): Promise<void> {
  const token = await getManagementToken();
  await axios.patch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      given_name: params.name,
      family_name: params.surname,
      name: `${params.name} ${params.surname}`.trim(),
      user_metadata: {
        name: params.name,
        surname: params.surname,
        phone_number: params.phone,
        phone_code: params.phoneCode,
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function deleteDriverUser(userId: string): Promise<void> {
  const token = await getManagementToken();
  await axios.delete(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function setDriverBlockStatus(userId: string, blocked: boolean): Promise<void> {
  const token = await getManagementToken();
  await axios.patch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    { blocked },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function createDriverUser(params: {
  name: string;
  surname: string;
  email: string;
  phone: string;
  phoneCode: string;
}): Promise<{ userId: string; email: string }> {
  const token = await getManagementToken();
  const crypto = require('crypto');
  const tempPassword = `Dr!${crypto.randomBytes(8).toString('hex')}1A`;

  const createResponse = await axios.post(
    `https://${AUTH0_DOMAIN}/api/v2/users`,
    {
      email: params.email,
      given_name: params.name,
      family_name: params.surname,
      name: `${params.name} ${params.surname}`.trim(),
      connection: 'Username-Password-Authentication',
      password: tempPassword,
      email_verified: false,
      app_metadata: { role: 'driver' },
      user_metadata: {
        name: params.name,
        surname: params.surname,
        phone_number: params.phone,
        phone_code: params.phoneCode,
      },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const userId = createResponse.data.user_id;

  await axios.post(`https://${AUTH0_DOMAIN}/dbconnections/change_password`, {
    client_id: process.env.AUTH0_CLIENT_ID,
    email: params.email,
    connection: 'Username-Password-Authentication',
  });

  return { userId, email: params.email };
}

export async function getUserDiscount(userId: string): Promise<number | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  const val = user.app_metadata?.discount_percentage;
  return val !== undefined && val !== null ? val : null;
}

export async function setUserDiscount(userId: string, discountPercentage: number | null): Promise<void> {
  const token = await getManagementToken();
  await axios.patch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    { app_metadata: { discount_percentage: discountPercentage } },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

export async function getAllDriverUsers(page: number, perPage: number): Promise<{
  users: {
    userId: string;
    email: string;
    name: string;
    surname: string;
    phone: string;
    phoneCode: string;
    blocked: boolean;
  }[];
  total: number;
}> {
  const token = await getManagementToken();

  // Fetch all users without Lucene search to avoid Auth0's indexing delay
  // (newly created users can take minutes to appear in q= search results)
  const allDrivers: Auth0User[] = [];
  const batchSize = 100;
  let authPage = 0;

  while (true) {
    const response = await axios.get<Auth0User[]>(
      `https://${AUTH0_DOMAIN}/api/v2/users`,
      {
        params: {
          page: authPage,
          per_page: batchSize,
          fields: 'user_id,email,given_name,family_name,user_metadata,app_metadata,blocked',
          include_fields: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const batch: Auth0User[] = response.data || [];
    const drivers = batch.filter(u => u.app_metadata?.role?.toLowerCase() === 'driver');
    allDrivers.push(...drivers);

    if (batch.length < batchSize) break;
    authPage++;
  }

  const total = allDrivers.length;
  const startIndex = page * perPage;
  const paginatedDrivers = allDrivers.slice(startIndex, startIndex + perPage);

  return {
    users: paginatedDrivers.map(user => ({
      userId: user.user_id,
      email: user.email,
      name: user.user_metadata?.name || user.given_name || '',
      surname: user.user_metadata?.surname || user.family_name || '',
      phone: user.user_metadata?.phone_number || '',
      phoneCode: user.user_metadata?.phone_code || '',
      blocked: user.blocked || false,
    })),
    total,
  };
}
