import { createContext, useContext, useEffect, useState, useCallback } from "react";

const AuthContext = createContext(null);

const BACKEND = "https://sap-poc-api.cfapps.us10-001.hana.ondemand.com"; // same-origin via Vite proxy; use "http://localhost:3001" if serving separately

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = () => {
    // Redirect to backend which kicks off the Keycloak OIDC flow.
    // No secrets ever reach the browser.
    window.location.href = `${BACKEND}/auth/login`;
  };

  const logout = () => {
    window.location.href = `${BACKEND}/auth/logout`;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
