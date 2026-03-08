// src/auth/auth0-config.ts — Auth0 connection settings.
//
// What is Auth0?
// Auth0 is a service that handles login for you. Instead of building your own
// username/password system (which is hard to do securely), you hand off the
// login screen to Auth0. They handle passwords, Google sign-in, Apple sign-in,
// email verification, and all the security complexity.
//
// What is OIDC?
// OIDC (OpenID Connect) is the standard protocol Auth0 uses. Think of it like
// a passport check — Auth0 verifies who the user is, then hands the app a
// signed "passport" (called a token) proving their identity.
//
// What is EXPO_PUBLIC_?
// Variables starting with EXPO_PUBLIC_ are read from the .env file and bundled
// into the app. They are NOT secret — they're visible inside the app binary.
// Auth0's domain and client ID are designed to be public (they're not passwords).
// Your ANTHROPIC_API_KEY, on the other hand, IS secret and should never use this prefix.

// The Auth0 "tenant" domain — unique to your Auth0 account.
// Format: "your-name.auth0.com"
// Get this from: auth0.com → Applications → Your App → Settings → Domain
export const AUTH0_DOMAIN =
  process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? "your-tenant.auth0.com";

// The Auth0 "Client ID" — identifies this specific app within your Auth0 account.
// Think of it like a username for the app itself (not for users).
// Get this from: auth0.com → Applications → Your App → Settings → Client ID
export const AUTH0_CLIENT_ID =
  process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? "your_client_id_here";

// The "audience" tells Auth0 which API this app is requesting access to.
// For fetching user profile info (name, email), the standard audience is the userinfo endpoint.
// e.g., "https://your-tenant.auth0.com/userinfo"
export const AUTH0_AUDIENCE = `https://${AUTH0_DOMAIN}/userinfo`;

// Scopes tell Auth0 what information the app is requesting about the user.
// "openid"  — required; enables OIDC and provides the ID token (the "passport")
// "profile" — gives access to the user's name and profile picture
// "email"   — gives access to the user's email address
export const AUTH0_SCOPES = ["openid", "profile", "email"];
