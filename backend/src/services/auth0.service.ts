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
  user_metadata?: {
    phone_number?: string;
    phone_code?: string;
  };
  app_metadata?: {
    role?: string;
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

export async function searchRegularUserByEmail(email: string): Promise<{
  found: boolean;
  userId?: string;
  fullName?: string;
  phone?: string;
  phoneCode?: string;
}> {
  const user = await getUserByEmail(email);

  if (!user) {
    return { found: false };
  }

  // Check app_metadata.role - exclude admin and driver users
  const userRole = user.app_metadata?.role?.toLowerCase();
  if (userRole === "admin" || userRole === "driver") {
    return { found: false };
  }

  const fullName = user.name || 
    [user.given_name, user.family_name].filter(Boolean).join(" ") || 
    "";

  return {
    found: true,
    userId: user.user_id,
    fullName,
    phone: user.user_metadata?.phone_number || "",
    phoneCode: user.user_metadata?.phone_code || "",
  };
}
