import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCurrentUser,
  login as loginApi,
  register as registerApi,
} from "../services/authApi";
import {
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "../services/tokenStorage";
import { AuthSessionValidationError } from "../services/authErrors";
import { AUTH_SESSION_UNAUTHORIZED_EVENT } from "../services/authSession";


interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
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
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  const clearAuthentication = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleUnauthorizedSession = () => clearAuthentication();

    window.addEventListener(
      AUTH_SESSION_UNAUTHORIZED_EVENT,
      handleUnauthorizedSession,
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_UNAUTHORIZED_EVENT,
        handleUnauthorizedSession,
      );
    };
  }, [clearAuthentication]);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = getStoredToken();

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        clearAuthentication();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [clearAuthentication]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const data = await loginApi({ email, password });

    storeToken(data.token, rememberMe);
    setToken(data.token);

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      clearAuthentication();
      throw new AuthSessionValidationError(error);
    }
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
      storeToken(data.token, true);
      setToken(data.token);

      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        clearAuthentication();
        throw new AuthSessionValidationError(error);
      }
    }
  };

  const logout = () => {
    clearAuthentication();
    localStorage.removeItem("eclectary-auth");
    sessionStorage.removeItem("eclectary-auth");
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
