import { auth } from "express-oauth2-jwt-bearer";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "dev-c2p14cvw0yc4psqt.us.auth0.com";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "https://park-and-travel-api";

export const checkJwt = auth({
  audience: AUTH0_AUDIENCE,
  issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});
