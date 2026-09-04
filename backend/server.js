import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { Issuer, generators } from "openid-client";

const {
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_CLIENT_SECRET,
  PORT = 8080,
  FRONTEND_URL = "http://localhost:5173",
  SESSION_SECRET,
} = process.env;

// ---------------------------------------------------------------------------
// In-memory session store (replace with Redis / DB in production)
// ---------------------------------------------------------------------------
const sessions = new Map();

function createSession(data) {
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

function getSession(id) {
  return id ? sessions.get(id) : null;
}

function updateSession(id, data) {
  const existing = sessions.get(id);
  if (!existing) return false;
  sessions.set(id, { ...existing, ...data });
  return true;
}

function deleteSession(id) {
  sessions.delete(id);
}

// ---------------------------------------------------------------------------
// Pending auth state store (short-lived, keyed by `state` param)
// ---------------------------------------------------------------------------
const pendingAuth = new Map();

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
let oidcClient;

async function bootstrap() {
  const issuerUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
  console.log(`[OIDC] Discovering ${issuerUrl} …`);
  const keycloakIssuer = await Issuer.discover(issuerUrl);

  oidcClient = new keycloakIssuer.Client({
    client_id: KEYCLOAK_CLIENT_ID,
    client_secret: KEYCLOAK_CLIENT_SECRET,       // only stored server-side
    redirect_uris: [`https://sap-poc-api.cfapps.us10-001.hana.ondemand.com/auth/callback`],
    post_logout_redirect_uris: [`${FRONTEND_URL}/`],
    response_types: ["code"],
  });

  console.log("[OIDC] Client ready");
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Parse session cookie manually (no cookie-parser dependency needed)
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  return { sessionId: cookies.sid, session: getSession(cookies.sid) };
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    `sid=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /auth/login  →  redirect browser to Keycloak login page
app.get("/auth/login", (_req, res) => {
  const state = generators.state();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  pendingAuth.set(state, { codeVerifier, createdAt: Date.now() });

  // Clean up stale pending entries (> 5 min)
  for (const [k, v] of pendingAuth) {
    if (Date.now() - v.createdAt > 5 * 60 * 1000) pendingAuth.delete(k);
  }

  const url = oidcClient.authorizationUrl({
    scope: "openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(url);
});

// GET /auth/callback  →  exchange code for tokens (server-side, with secret)
app.get("/auth/callback", async (req, res) => {
  try {
    const params = oidcClient.callbackParams(req);
    const pending = pendingAuth.get(params.state);

    if (!pending) {
      return res.status(400).send("Unknown or expired state parameter");
    }

    pendingAuth.delete(params.state);

    const tokenSet = await oidcClient.callback(
      `https://sap-poc-api.cfapps.us10-001.hana.ondemand.com/auth/callback`,
      params,
      { code_verifier: pending.codeVerifier, state: params.state }
    );

    const claims = tokenSet.claims();
    const sessionId = createSession({
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      idToken: tokenSet.id_token,
      expiresAt: tokenSet.expires_at,
      user: {
        sub: claims.sub,
        name: claims.name,
        email: claims.email,
        preferredUsername: claims.preferred_username,
      },
    });

    setSessionCookie(res, sessionId);
    res.redirect(`${FRONTEND_URL}/`);
  } catch (err) {
    console.error("[callback error]", err);
    res.status(500).send("Authentication failed");
  }
});

// GET /auth/logout  →  end session at Keycloak then clear local session
app.get("/auth/logout", (req, res) => {
  const { sessionId, session } = getSessionFromRequest(req);
  const idToken = session?.idToken;

  if (sessionId) deleteSession(sessionId);
  clearSessionCookie(res);

  const logoutUrl = oidcClient.endSessionUrl({
    id_token_hint: idToken,
    post_logout_redirect_uri: `${FRONTEND_URL}/`,
  });

  res.redirect(logoutUrl);
});

// GET /api/me  →  return the currently logged-in user (from session)
app.get("/api/me", async (req, res) => {
  const { sessionId, session } = getSessionFromRequest(req);

  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Refresh token if within 60 s of expiry
  try {
    if (session.expiresAt && Date.now() / 1000 > session.expiresAt - 60) {
      if (session.refreshToken) {
        const refreshed = await oidcClient.refresh(session.refreshToken);
        const claims = refreshed.claims();
        updateSession(sessionId, {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? session.refreshToken,
          idToken: refreshed.id_token ?? session.idToken,
          expiresAt: refreshed.expires_at,
          user: {
            sub: claims.sub,
            name: claims.name,
            email: claims.email,
            preferredUsername: claims.preferred_username,
          },
        });
      }
    }
  } catch (err) {
    console.warn("[token refresh failed]", err.message);
    deleteSession(sessionId);
    clearSessionCookie(res);
    return res.status(401).json({ error: "Session expired" });
  }

  const fresh = getSession(sessionId);
  res.json({ user: fresh.user });
});

// GET /api/protected  →  example protected resource
app.get("/api/protected", (req, res) => {
  const { session } = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  res.json({
    message: "You reached a protected API endpoint!",
    user: session.user,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
bootstrap()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`[server] Listening on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Failed to initialise OIDC client:", err);
    process.exit(1);
  });
