export const AUTH_SESSION_UNAUTHORIZED_EVENT = "eclectary:auth-session-unauthorized";

export interface UnauthorizedAuthSessionDetail {
  token: string;
}

export function notifyUnauthorizedAuthSession(token: string) {
  window.dispatchEvent(new CustomEvent<UnauthorizedAuthSessionDetail>(
    AUTH_SESSION_UNAUTHORIZED_EVENT,
    { detail: { token } },
  ));
}
