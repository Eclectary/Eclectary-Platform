const TOKEN_STORAGE_KEY = "token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
    ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string, rememberMe: boolean) {
  clearStoredToken();

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}
