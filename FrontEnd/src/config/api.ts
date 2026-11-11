const LOCAL_API_BASE_URL = "http://localhost:3000/api/v1";

export function resolveApiBaseUrl(configuredUrl: string | undefined, production: boolean) {
  const candidate = configuredUrl?.trim();

  if (!candidate) {
    if (production) {
      throw new Error("VITE_API_URL must be configured for production builds");
    }

    return LOCAL_API_BASE_URL;
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("VITE_API_URL must be an absolute HTTP(S) URL");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("VITE_API_URL must be an absolute HTTP(S) URL without credentials");
  }

  if (production && url.protocol !== "https:") {
    throw new Error("VITE_API_URL must use HTTPS for production builds");
  }

  if (url.search || url.hash) {
    throw new Error("VITE_API_URL must not include query parameters or a fragment");
  }

  return candidate.replace(/\/+$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD);
