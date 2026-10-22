import { API_BASE_URL } from "../config/api";

export function getProductImageUrl(image: string): string {
  if (!image.startsWith("/")) {
    return image;
  }

  const fallbackOrigin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;
  const apiOrigin = new URL(API_BASE_URL || "/api/v1", fallbackOrigin).origin;
  return new URL(image, apiOrigin).toString();
}
