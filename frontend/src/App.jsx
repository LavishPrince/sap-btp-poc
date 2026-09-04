import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import styles from "./App.module.css";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const apiUrl = "https://sap-poc-api.cfapps.us10-001.hana.ondemand.com"
function Header() {
  const { user, login, logout } = useAuth();
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>KeycloakDemo</span>
        </div>
        <div className={styles.headerActions}>
          {user ? (
            <>
              <span className={styles.headerUser}>{user.name || user.preferredUsername}</span>
              <button className={styles.btnOutline} onClick={logout}>Sign out</button>
            </>
          ) : (
            <button className={styles.btnPrimary} onClick={login}>Sign in</button>
          )}
        </div>
      </div>
    </header>
  );
}

function LoadingScreen() {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.spinner} />
      <p>Checking session…</p>
    </div>
  );
}

function GuestView() {
  const { login } = useAuth();
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.badge}>OpenID Connect · PKCE · Backend token exchange</div>
        <h1 className={styles.heroTitle}>
          Secure auth<br/>without secrets<br/>in the browser.
        </h1>
        <p className={styles.heroSub}>
          The frontend never sees the client secret or raw tokens — it only
          holds a server-side session cookie. The Express backend handles the
          full OIDC code flow with Keycloak.
        </p>
        <button className={styles.btnHero} onClick={login}>
          Sign in with Keycloak →
        </button>
      </section>

      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <ol className={styles.steps}>
          {[
            ["Browser → Backend", "Click \"Sign in\" — the browser hits /auth/login on the Express server."],
            ["Backend → Keycloak", "Express builds an authorization URL with a PKCE code_challenge and redirects the browser to Keycloak."],
            ["Keycloak → Backend", "After login, Keycloak sends the code to /auth/callback. Express exchanges it for tokens using the client secret — never exposed to the browser."],
            ["Session cookie", "Express stores the tokens server-side and issues an HttpOnly session cookie to the browser."],
            ["API calls", "React calls /api/me and /api/protected with credentials. Express reads the session, refreshes tokens if needed, and returns user data."],
          ].map(([title, desc], i) => (
            <li key={i} className={styles.step}>
              <span className={styles.stepNum}>{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function UserDashboard() {
  const { user } = useAuth();
  const [apiResult, setApiResult] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  const callProtected = async () => {
    setApiLoading(true);
    setApiError(null);
    setApiResult(null);
    try {
      const res = await fetch(apiUrl + "/api/protected", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setApiResult(data);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <section className={styles.dashboard}>
        <div className={styles.welcomeCard}>
          <div className={styles.avatar}>
            {(user.name || user.preferredUsername || "?")[0].toUpperCase()}
          </div>
          <div>
            <h2 className={styles.welcomeName}>Welcome back, {user.name || user.preferredUsername}</h2>
            <p className={styles.welcomeSub}>You are authenticated via Keycloak OIDC</p>
          </div>
        </div>

        <div className={styles.cards}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Profile</h3>
            <dl className={styles.dl}>
              {[
                ["Subject", user.sub],
                ["Name", user.name],
                ["Email", user.email],
                ["Username", user.preferredUsername],
              ].map(([label, value]) =>
                value ? (
                  <div key={label} className={styles.dlRow}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ) : null
              )}
            </dl>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Protected API</h3>
            <p className={styles.cardDesc}>
              Call <code>/api/protected</code> — the backend verifies your
              session and returns a response. No token is ever sent from the
              browser.
            </p>
            <button
              className={styles.btnPrimary}
              onClick={callProtected}
              disabled={apiLoading}
            >
              {apiLoading ? "Calling…" : "Call /api/protected"}
            </button>

            {apiError && (
              <pre className={styles.errorBox}>{apiError}</pre>
            )}

            {apiResult && (
              <pre className={styles.resultBox}>
                {JSON.stringify(apiResult, null, 2)}
              </pre>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Security notes</h3>
            <ul className={styles.notesList}>
              <li>Client secret lives only in the backend <code>.env</code></li>
              <li>Access &amp; refresh tokens are stored server-side</li>
              <li>The browser holds only an HttpOnly session cookie</li>
              <li>PKCE is used to prevent authorization code interception</li>
              <li>Tokens are silently refreshed before expiry</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <div className={styles.layout}>
      <Header />
      {user ? <UserDashboard /> : <GuestView />}
      <footer className={styles.footer}>
        <p>React + Express + Keycloak OpenID Connect · no secrets in the browser</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
