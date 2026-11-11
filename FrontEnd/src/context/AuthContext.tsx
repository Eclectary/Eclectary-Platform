import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
import {
  AUTH_SESSION_UNAUTHORIZED_EVENT,
  type UnauthorizedAuthSessionDetail,
} from "../services/authSession";
import type { User } from "../types/user";

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
  const activeToken = useRef(token);
  const sessionVersion = useRef(0);
  const pendingSessionVersion = useRef<number | null>(token ? 0 : null);

  const clearAuthentication = useCallback(() => {
    sessionVersion.current += 1;
    pendingSessionVersion.current = null;
    activeToken.current = null;
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const startAuthenticationRequest = () => {
    const requestVersion = ++sessionVersion.current;

    if (pendingSessionVersion.current !== null) {
      pendingSessionVersion.current = null;
      activeToken.current = null;
      clearStoredToken();
      setToken(null);
      setUser(null);
    }

    return requestVersion;
  };

  useEffect(() => {
    const handleUnauthorizedSession = (event: Event) => {
      const unauthorizedEvent = event as CustomEvent<UnauthorizedAuthSessionDetail>;

      if (unauthorizedEvent.detail?.token === activeToken.current) {
        clearAuthentication();
      }
    };

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
      const requestVersion = sessionVersion.current;
      const storedToken = getStoredToken();

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (sessionVersion.current === requestVersion) {
          pendingSessionVersion.current = null;
          setUser(currentUser);
        }
      } catch {
        if (sessionVersion.current === requestVersion) {
          clearAuthentication();
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [clearAuthentication]);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const requestVersion = startAuthenticationRequest();
    const data = await loginApi({ email, password });

    if (sessionVersion.current !== requestVersion) return;

    storeToken(data.token, rememberMe);
    pendingSessionVersion.current = requestVersion;
    activeToken.current = data.token;
    setToken(data.token);

    try {
      const currentUser = await getCurrentUser();
      if (sessionVersion.current === requestVersion) {
        pendingSessionVersion.current = null;
        setUser(currentUser);
      }
    } catch (error) {
      if (sessionVersion.current === requestVersion) {
        clearAuthentication();
      }
      throw new AuthSessionValidationError(error);
    }
  };

  const register = async (
    email: string,
    password: string,
    passwordConfirmation: string
  ) => {
    const requestVersion = startAuthenticationRequest();
    const data = await registerApi({
      email,
      password,
      password_confirmation: passwordConfirmation,
    });

    if (sessionVersion.current !== requestVersion) return;

    if (data.token) {
      storeToken(data.token, true);
      pendingSessionVersion.current = requestVersion;
      activeToken.current = data.token;
      setToken(data.token);

      try {
        const currentUser = await getCurrentUser();
        if (sessionVersion.current === requestVersion) {
          pendingSessionVersion.current = null;
          setUser(currentUser);
        }
      } catch (error) {
        if (sessionVersion.current === requestVersion) {
          clearAuthentication();
        }
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
