"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole } from "@/types";
import { api, getToken, removeToken, setToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    const savedToken = getToken();
    if (!savedToken) {
      setUser(null);
      setTokenState(null);
      setLoading(false);
      return;
    }

    try {
      setTokenState(savedToken);
      const profile = await api.auth.getMe();
      setUser(profile);
    } catch {
      removeToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, pass: string) => {
    const res = await api.auth.login(username, pass);
    setToken(res.token);
    setTokenState(res.token);
    setUser({
      id: res.userId,
      fullName: res.fullName,
      username: res.username,
      role: res.role,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    router.push("/dashboard");
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setTokenState(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
