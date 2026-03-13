import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { AuthContext, fetchMe, type AuthContextValue, type AuthUser } from "../lib/auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login: async (input) => {
        await api.post("/auth/login", input);
        const me = await fetchMe();
        setUser(me);
        return me;
      },
      register: async (input) => {
        await api.post("/auth/register", input);
        const me = await fetchMe();
        setUser(me);
        return me;
      },
      logout: async () => {
        try {
          await api.post("/auth/logout");
        } finally {
          setUser(null);
        }
      },
      refreshUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
