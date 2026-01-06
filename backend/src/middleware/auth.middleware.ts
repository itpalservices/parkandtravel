import { auth } from "express-oauth2-jwt-bearer";
import { Request, Response, NextFunction } from "express";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "dev-c2p14cvw0yc4psqt.us.auth0.com";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "https://park-and-travel-api";
const ROLE_NAMESPACE = "https://park-and-travel/roles";

export type UserRole = "admin" | "driver" | "user";

export interface AuthUser {
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const jwtCheck = auth({
  audience: AUTH0_AUDIENCE,
  issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});

function extractUserInfo(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as any).auth;
  
  if (!auth?.payload) {
    req.authUser = { email: "", role: "user" };
    return next();
  }

  const payload = auth.payload;
  
  const email = payload.email || 
                payload["https://park-and-travel/email"] || 
                "";

  let role: UserRole = "user";
  const rolesClaim = payload[ROLE_NAMESPACE];
  
  if (Array.isArray(rolesClaim) && rolesClaim.length > 0) {
    const claimedRole = rolesClaim[0].toLowerCase();
    if (claimedRole === "admin" || claimedRole === "driver" || claimedRole === "user") {
      role = claimedRole;
    }
  } else if (typeof rolesClaim === "string") {
    const claimedRole = rolesClaim.toLowerCase();
    if (claimedRole === "admin" || claimedRole === "driver" || claimedRole === "user") {
      role = claimedRole;
    }
  }

  req.authUser = { email, role };
  next();
}

export const checkJwt = [jwtCheck, extractUserInfo];
