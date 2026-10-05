import api from "./api";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirmation: string;
}

export const login = async (credentials: LoginCredentials) => {
  const response = await api.post("/login", credentials);
  return response.data;
};

export const register = async (userData: RegisterData) => {
  const response = await api.post("/users", {
    user: userData,
  });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/users/me");
  return response.data;
};

export default {
  login,
  register,
  getCurrentUser,
};