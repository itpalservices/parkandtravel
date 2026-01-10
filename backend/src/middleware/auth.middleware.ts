import { auth, InvalidRequestError, UnauthorizedError } from "express-oauth2-jwt-bearer";
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

export const checkJwt = [jwtCheckWithErrorHandling, extractUserInfo];

export function getUserRole(auth: any): UserRole {
  if (!auth?.payload) {
    return "user";
  }

  const payload = auth.payload;
  const rolesClaim = payload[ROLE_NAMESPACE];

  if (Array.isArray(rolesClaim) && rolesClaim.length > 0) {
    const claimedRole = rolesClaim[0].toLowerCase();
    if (claimedRole === "admin" || claimedRole === "driver" || claimedRole === "user") {
      return claimedRole;
    }
  } else if (typeof rolesClaim === "string") {
    const claimedRole = rolesClaim.toLowerCase();
    if (claimedRole === "admin" || claimedRole === "driver" || claimedRole === "user") {
      return claimedRole;
    }
  }

  return "user";
}
