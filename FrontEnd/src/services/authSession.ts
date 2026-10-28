export const AUTH_SESSION_UNAUTHORIZED_EVENT = "eclectary:auth-session-unauthorized";

export function notifyUnauthorizedAuthSession() {
  window.dispatchEvent(new Event(AUTH_SESSION_UNAUTHORIZED_EVENT));
}
