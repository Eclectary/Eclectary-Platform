import axios from "axios";

import { API_BASE_URL } from "../config/api";
import { notifyUnauthorizedAuthSession } from "./authSession";
import { clearStoredToken, getStoredToken } from "./tokenStorage";

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function isAuthenticationAttempt(method?: string, url?: string) {
  if (method?.toLowerCase() !== "post" || !url) {
    return false;
  }

  const path = url.split("?")[0].replace(/\/+$/, "");
  return path === "/login" || path === "/users";
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const request = axios.isAxiosError(error) ? error.config : undefined;
    const authorization = request?.headers?.Authorization;

    if (
      error.response?.status === 401
      && authorization
      && !isAuthenticationAttempt(request?.method, request?.url)
      && getStoredToken()
    ) {
      clearStoredToken();
      notifyUnauthorizedAuthSession();
    }

    return Promise.reject(error);
  },
);

export default api;
