// src/auth/AuthContext.tsx — The authentication brain of the app.
//
// ─── Concepts explained ────────────────────────────────────────────────────
//
// What is a React Context?
// A Context is a way to share data across many components without passing it
// down through every layer manually. Think of it like a radio broadcast —
// the AuthProvider broadcasts the user's login state, and any screen can
// tune in with useAuth() to receive it.
//
// What is a Provider?
// The AuthProvider component wraps the whole app (in _layout.tsx). It holds
// the login state and gives child components access to it via the Context.
//
// What is a Hook?
// useAuth() is a custom hook — a function that lets any screen access the
// user's login state with one line: const { user, login, logout } = useAuth();
//
// What is PKCE?
// PKCE (Proof Key for Code Exchange, pronounced "pixie") is a security
// technique for mobile apps. Since mobile apps can't keep secrets (anyone
// can decompile them), PKCE proves the login request came from your app
// without needing a client secret. expo-auth-session handles this automatically.
//
// What is SecureStore?
// expo-secure-store saves data in the phone's encrypted keychain (iOS) or
// encrypted shared preferences (Android). It's like a safe on the phone —
// other apps and users can't read it, even if the phone is not locked.
//
// ─── Login flow summary ─────────────────────────────────────────────────────
// 1. User taps "Sign In"
// 2. App generates a PKCE code verifier + challenge
// 3. Auth0 Universal Login opens in a browser (handled by expo-web-browser)
// 4. User enters credentials / chooses Google
// 5. Auth0 redirects back to the app with an authorization "code"
// 6. App exchanges the code for tokens (ID token + access token)
// 7. App decodes the ID token to get user info (sub, email, name)
// 8. User info is stored in SecureStore and in React state
// 9. App navigates to the dashboard

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  AUTH0_SCOPES,
} from "./auth0-config";

// ─── IMPORTANT: iOS requires this call ────────────────────────────────────
// On iOS, after Auth0 redirects back to the app, the browser window stays
// open until this function closes it. Call it at the top of the file so it
// runs as soon as the module loads.
WebBrowser.maybeCompleteAuthSession();

// ─── SecureStore key names ─────────────────────────────────────────────────
// These are the keys used to store data in the encrypted keychain.
// They're just strings — like the label on a safe deposit box.
const SECURE_STORE_USER_KEY = "medicine_tracker_user";
const SECURE_STORE_TOKEN_KEY = "medicine_tracker_access_token";

// ─── Types ─────────────────────────────────────────────────────────────────

// The user object available throughout the app after login.
// `sub` is the Auth0 User ID — a unique, stable identifier like "auth0|abc123".
// This is what we store in every database table as `user_id`.
export interface AuthUser {
  sub: string;    // e.g., "auth0|abc123xyz" — used as userId for all DB queries
  email: string;  // e.g., "john@example.com"
  name: string;   // e.g., "John Smith" (from Google profile or Auth0 account)
}

// The value provided by AuthContext to every child component.
export interface AuthContextValue {
  user: AuthUser | null; // null = not logged in
  isLoading: boolean;    // true while checking stored tokens on startup
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context creation ──────────────────────────────────────────────────────
// createContext sets up the broadcast channel. null is the default value —
// we throw an error if useAuth() is called outside of AuthProvider.
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── AuthProvider ──────────────────────────────────────────────────────────
// Wrap your app with this component (in app/_layout.tsx) to enable auth
// throughout the entire app.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // user: the logged-in user's info, or null if not logged in
  const [user, setUser] = useState<AuthUser | null>(null);

  // isLoading: true while we're checking SecureStore for a saved token on startup.
  // During this time, we show a loading screen instead of the login screen.
  const [isLoading, setIsLoading] = useState(true);

  // The redirect URI tells Auth0 where to send the user after login.
  // makeRedirectUri() automatically picks the right URI for the environment:
  // - In Expo Go (development): "exp://192.168.x.x:8081"
  // - In a production build:    "medicine-tracker://callback"
  // You must add this URI to Auth0's "Allowed Callback URLs" setting.
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "medicine-tracker", // matches the "scheme" in app.json
    path: "callback",
  });

  // useAutoDiscovery fetches Auth0's "discovery document" — a JSON file at
  // https://your-tenant.auth0.com/.well-known/openid-configuration
  // that lists all the Auth0 endpoint URLs (login, token, userinfo, etc.)
  // We pass this to useAuthRequest so it knows where to send requests.
  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);

  // useAuthRequest sets up the PKCE login request.
  // - request: contains the code_verifier needed for token exchange
  // - response: set after the user completes the Auth0 login
  // - promptAsync: call this to open the Auth0 browser login screen
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      scopes: AUTH0_SCOPES,
      redirectUri,
      // audience restricts the token to the userinfo endpoint
      // (good security practice — tokens should have minimal scope)
      extraParams: { audience: AUTH0_AUDIENCE },
    },
    discovery // null until the discovery document is fetched; useAuthRequest waits for it
  );

  // We use a ref to always have access to the latest `request` object
  // inside async callbacks without needing to list it as an effect dependency.
  // A ref is like a box — it holds a value that doesn't trigger re-renders when changed.
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  // ─── On app startup: check for a saved session ──────────────────────────
  useEffect(() => {
    async function restoreSession() {
      try {
        // Try to read the user object we saved in SecureStore after the last login.
        // getItemAsync returns null if the key doesn't exist (first launch or after logout).
        const storedUserJson = await SecureStore.getItemAsync(SECURE_STORE_USER_KEY);
        if (storedUserJson) {
          // Parse the JSON string back into an AuthUser object
          // e.g., '{"sub":"auth0|abc","email":"a@b.com","name":"Alice"}' → AuthUser
          setUser(JSON.parse(storedUserJson) as AuthUser);
        }
      } catch {
        // If reading fails (corrupted data, etc.), stay logged out silently.
        // The user will just see the login screen.
      } finally {
        // Whether we found a user or not, we're done loading.
        // This hides the loading screen and shows either the dashboard or login screen.
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []); // [] means "run once when the component first mounts"

  // ─── After Auth0 login: exchange code for tokens ────────────────────────
  useEffect(() => {
    // response is set by useAuthRequest after the user completes the Auth0 flow.
    // type === "success" means the user logged in; "dismiss" means they cancelled.
    if (response?.type !== "success" || !discovery) return;

    async function handleSuccessfulLogin() {
      if (response?.type !== "success") return;

      try {
        // The authorization "code" is a one-time-use short-lived string.
        // We exchange it for real tokens using the code_verifier from the request.
        // This exchange happens directly with Auth0 (not through a browser).
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            code: response.params.code,
            redirectUri,
            extraParams: {
              // The code_verifier proves this token exchange matches the original request.
              // It's the secret half of the PKCE challenge — only the original requester has it.
              code_verifier: requestRef.current?.codeVerifier ?? "",
            },
          },
          discovery!
        );

        // The ID token is a JWT (JSON Web Token) — a signed string with 3 parts
        // separated by dots: header.payload.signature
        // The payload contains user info like sub, email, name.
        const idToken = tokenResult.idToken;
        if (!idToken) throw new Error("Auth0 did not return an ID token.");

        // Decode the JWT payload to extract user info.
        // We don't need to verify the signature here — Auth0 already verified it
        // before issuing the token.
        const payload = decodeJwtPayload(idToken);

        const authUser: AuthUser = {
          // sub is Auth0's unique user ID — stable and never changes for a user
          // e.g., "auth0|64abc123xyz" for email/password users
          //        "google-oauth2|115abc..." for Google sign-in users
          sub: payload.sub as string,
          email: (payload.email as string) ?? "",
          name: (payload.name as string) ?? (payload.email as string) ?? "User",
        };

        // Save to SecureStore so the session persists after the app is closed.
        // Next time the app opens, restoreSession() will find this and skip login.
        await SecureStore.setItemAsync(SECURE_STORE_USER_KEY, JSON.stringify(authUser));
        await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, tokenResult.accessToken);

        // Update React state — this triggers a re-render and navigates to the dashboard
        setUser(authUser);
      } catch (error) {
        console.error("Login failed:", error);
        // If token exchange fails, stay on the login screen.
      }
    }

    handleSuccessfulLogin();
  }, [response, discovery, redirectUri]);

  // ─── login: open the Auth0 login screen ─────────────────────────────────
  // useCallback ensures this function reference is stable — it won't be
  // recreated on every render, which matters when passing it to child components.
  const login = useCallback(async () => {
    // promptAsync opens the Auth0 Universal Login page in a secure browser window.
    // The browser handles: password entry, Google/Apple OAuth, MFA, etc.
    // When done, Auth0 redirects back to the app using the redirectUri.
    await promptAsync();
  }, [promptAsync]);

  // ─── logout: clear the session ────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Remove the stored user and token from the encrypted keychain.
    // After this, the next app launch will show the login screen.
    await SecureStore.deleteItemAsync(SECURE_STORE_USER_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);

    // Clear from React state — triggers re-render and navigates to login screen
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── useAuth ───────────────────────────────────────────────────────────────
// The hook that any screen calls to access auth state.
// Usage: const { user, login, logout, isLoading } = useAuth();
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // This error fires during development if you forget to wrap the app with AuthProvider.
    throw new Error("useAuth() must be called inside <AuthProvider>. Check app/_layout.tsx.");
  }
  return ctx;
}

// ─── JWT decoder ──────────────────────────────────────────────────────────
// Decodes the payload section of a JWT token without verifying the signature.
// A JWT looks like: xxxxx.yyyyy.zzzzz
// The middle part (yyyyy) is the payload — base64url-encoded JSON.
//
// "base64url" is like base64 but uses - instead of + and _ instead of /
// because + and / have special meaning in URLs.
function decodeJwtPayload(token: string): Record<string, unknown> {
  // Split on dots and take the second part (index 1 = payload)
  const payloadBase64url = token.split(".")[1];
  if (!payloadBase64url) throw new Error("Invalid JWT: missing payload segment.");

  // Convert base64url → standard base64 by swapping the special characters
  const base64 = payloadBase64url.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding ("=") to make the length a multiple of 4 — base64 requires this
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  // atob() decodes base64 to a string. Available in React Native 0.73+ and modern browsers.
  const jsonString = atob(padded);

  return JSON.parse(jsonString) as Record<string, unknown>;
}
