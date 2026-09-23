import { auth, InvalidRequestError, UnauthorizedError } from "express-oauth2-jwt-bearer";
import { Request, Response, NextFunction } from "express";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "powersoft.eu.auth0.com";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "https://park-and-travel-api";
const ROLE_NAMESPACE = "https://park-and-travel/roles";

export type UserRole = "admin" | "driver" | "user" | "super_admin";

const KNOWN_ROLES: UserRole[] = ["admin", "driver", "user", "super_admin"];

/** super_admin is a restricted role: it may call only these endpoints. Every other endpoint
 *  behind checkJwt answers 403, because many handlers only reject role "user" and would
 *  otherwise let an unknown role through. */
const SUPER_ADMIN_ALLOWED: { method: string; path: RegExp }[] = [
  { method: "GET", path: /^\/api\/bookings\/undelivered-receipts\/?$/ },
  { method: "POST", path: /^\/api\/bookings\/undelivered-receipts\/dismiss\/?$/ },
];

function parseRoleClaim(rolesClaim: unknown): UserRole | null {
  const claimed = Array.isArray(rolesClaim) ? rolesClaim[0] : rolesClaim;
  if (typeof claimed !== "string") return null;
  const role = claimed.toLowerCase() as UserRole;
  return KNOWN_ROLES.includes(role) ? role : null;
}

export interface AuthUser {
  sub: string;
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

function handleAuthError(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof InvalidRequestError) {
    res.status(401).json({ 
      error: "Access token is required",
      message: "Please provide a valid access token in the Authorization header"
    });
    return;
  }
  if (err instanceof UnauthorizedError) {
    res.status(401).json({ 
      error: "Invalid or expired token",
      message: "Your access token is invalid or has expired. Please log in again."
    });
    return;
  }
  next(err);
}

function jwtCheckWithErrorHandling(req: Request, res: Response, next: NextFunction): void {
  jwtCheck(req, res, (err?: any) => {
    if (err) {
      handleAuthError(err, req, res, next);
    } else {
      next();
    }
  });
}

function extractUserInfo(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as any).auth;
  
  if (!auth?.payload) {
    req.authUser = { sub: "", email: "", role: "user" };
    return next();
  }

  const payload = auth.payload;
  
  const sub = payload.sub || "";
  
  const email = payload.email || 
                payload["https://park-and-travel/email"] || 
                "";

  const role: UserRole = parseRoleClaim(payload[ROLE_NAMESPACE]) ?? "user";

  req.authUser = { sub, email, role };
  next();
}

function restrictSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.authUser?.role !== "super_admin") return next();
  const path = req.originalUrl.split("?")[0];
  if (SUPER_ADMIN_ALLOWED.some((a) => a.method === req.method && a.path.test(path))) return next();
  res.status(403).json({ error: "Not available for this role" });
}

export const checkJwt = [jwtCheckWithErrorHandling, extractUserInfo, restrictSuperAdmin];

export function getUserRole(auth: any): UserRole {
  if (!auth?.payload) {
    return "user";
  }

  return parseRoleClaim(auth.payload[ROLE_NAMESPACE]) ?? "user";
}
