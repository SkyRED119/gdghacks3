import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, getToken, setToken, clearToken } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  xp: number;
  level: number;
  streak: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signOut: () => void;
  handleGoogleSuccess: (idToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);

  // On mount, verify existing token with backend
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setTokenState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleGoogleSuccess = async (idToken: string) => {
    const data = await api.googleAuth(idToken);
    setToken(data.token);
    setTokenState(data.token);
    setUser({
      id: data.userId,
      email: data.email,
      name: data.name ?? "",
      picture: data.picture ?? "",
      xp: 0,
      level: 1,
      streak: 0,
    });
  };

  const signOut = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, signOut, handleGoogleSuccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
