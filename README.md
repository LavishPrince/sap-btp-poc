# Keycloak OIDC Demo — React + Express

A minimal, production-pattern authentication setup:

- **Frontend** (React + Vite) — zero secrets, zero tokens. Holds only an `HttpOnly` session cookie.
- **Backend** (Express + `openid-client`) — owns the client secret and manages the full OIDC code flow with PKCE.

## Architecture

```
Browser                    Express Backend              Keycloak
  │                              │                          │
  │  GET /auth/login             │                          │
  │─────────────────────────────>│                          │
  │                              │  redirect + PKCE params  │
  │<─────────────────────────────│─────────────────────────>│
  │                              │                          │  (user logs in)
  │  GET /auth/callback?code=…   │<─────────────────────────│
  │─────────────────────────────>│                          │
  │                              │  POST /token (+ secret)  │
  │                              │─────────────────────────>│
  │                              │<─────────────────────────│
  │  302 → /  + Set-Cookie: sid  │  (tokens stored in mem)  │
  │<─────────────────────────────│                          │
  │                              │                          │
  │  GET /api/me  (cookie)       │                          │
  │─────────────────────────────>│                          │
  │  { user: { name, email … } } │                          │
  │<─────────────────────────────│                          │
```

**The client secret never leaves the backend process.**

---

## Quick Start

### 1. Keycloak setup

1. Start Keycloak (Docker is easiest):

```bash
docker run -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev
```

2. Log in at http://localhost:8080 → Admin Console
3. Create a realm (e.g. `myrealm`)
4. Create a **Confidential** client:
   - Client ID: `myapp-backend`
   - Client authentication: **ON**
   - Valid redirect URIs: `http://localhost:3001/auth/callback`
   - Web origins: `http://localhost:5173`
5. Copy the **Client Secret** from the *Credentials* tab

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Environment Variables

| Variable | Description |
|---|---|
| `KEYCLOAK_URL` | Base URL of your Keycloak instance, e.g. `http://localhost:8080` |
| `KEYCLOAK_REALM` | Realm name |
| `KEYCLOAK_CLIENT_ID` | Client ID (confidential client) |
| `KEYCLOAK_CLIENT_SECRET` | Client secret — **backend only, never expose to browser** |
| `PORT` | Backend port (default `3001`) |
| `FRONTEND_URL` | Frontend origin for CORS + post-logout redirect |
| `SESSION_SECRET` | Random string used to sign session IDs |

---

## Security design decisions

| Decision | Reason |
|---|---|
| PKCE (`S256`) | Prevents authorization code interception even if the redirect URL is observed |
| Confidential client on backend | Client secret stays server-side; browser never sees it |
| HttpOnly session cookie | JavaScript cannot read the cookie; mitigates XSS token theft |
| Tokens stored server-side | Access and refresh tokens never travel to the browser |
| Token auto-refresh | Backend refreshes access token when < 60 s from expiry |
| SameSite=Lax cookie | Mitigates CSRF for state-changing requests |

---

## Production checklist

- [ ] Replace the in-memory session store with Redis or a database
- [ ] Use HTTPS everywhere and add `Secure` flag to the cookie
- [ ] Set `SameSite=Strict` if your frontend and backend share an origin
- [ ] Rotate `SESSION_SECRET` and store it in a secrets manager
- [ ] Configure Keycloak with proper realm and token lifetimes
- [ ] Add rate limiting to `/auth/login` and `/auth/callback`
