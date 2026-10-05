import { createContext, useContext, useEffect, useState } from "react";
import {
  getCurrentUser,
  login as loginApi,
  register as registerApi,
} from "../services/authApi";


interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    passwordConfirmation: string
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem("token");

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await loginApi({ email, password });

    localStorage.setItem("token", data.token);
    setToken(data.token);

    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  const register = async (
    email: string,
    password: string,
    passwordConfirmation: string
  ) => {
    const data = await registerApi({
      email,
      password,
      password_confirmation: passwordConfirmation,
    });

    if (data.token) {
      localStorage.setItem("token", data.token);
      setToken(data.token);

      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}