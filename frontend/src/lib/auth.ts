import { createContext, useContext } from "react";
import api from "./api";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  techStack: string[];
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  register: (input: { username: string; email: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export async function fetchMe() {
  const response = await api.get("/auth/me");
  return response.data.data as AuthUser;
}
