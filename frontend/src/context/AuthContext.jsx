import React, { createContext, useContext, useState, useCallback } from "react";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("kc_token") || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kc_user") || "null"); } catch { return null; }
  });

  const login = useCallback((tok, u) => {
    setToken(tok); setUser(u);
    localStorage.setItem("kc_token", tok);
    localStorage.setItem("kc_user", JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setToken(""); setUser(null);
    localStorage.removeItem("kc_token");
    localStorage.removeItem("kc_user");
  }, []);

  return <AuthCtx.Provider value={{ token, user, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
