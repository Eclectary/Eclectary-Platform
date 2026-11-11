import { parseApiError } from "./apiErrors";

type AuthErrorField = "email" | "form";

export interface AuthDisplayError {
  field: AuthErrorField;
  message: string;
}

export class AuthSessionValidationError extends Error {
  constructor(cause?: unknown) {
    super("Authentication session validation failed", { cause });
    this.name = "AuthSessionValidationError";
  }
}

export function normalizeLoginError(error: unknown): AuthDisplayError {
  if (error instanceof AuthSessionValidationError) {
    return {
      field: "form",
      message: "We couldn't verify your session. Please sign in again.",
    };
  }

  const apiError = parseApiError(error, "Unable to sign in right now. Please try again.");
  if (
    apiError.status === 401
    && apiError.messages.includes("Invalid email or password")
  ) {
    return {
      field: "email",
      message: "Invalid email or password.",
    };
  }

  return {
    field: "form",
    message: apiError.message,
  };
}

export function normalizeRegistrationError(error: unknown): AuthDisplayError {
  if (error instanceof AuthSessionValidationError) {
    return {
      field: "form",
      message: "Your account was created, but we couldn't sign you in. Please sign in.",
    };
  }

  const apiError = parseApiError(error, "Unable to create your account right now. Please try again.");
  const validationErrors = apiError.status === 422
    ? apiError.messages
    : [];

  if (validationErrors.some((message) => /email has already been taken/i.test(message))) {
    return {
      field: "email",
      message: "An account with this email already exists.",
    };
  }

  if (validationErrors.length > 0) {
    return {
      field: "form",
      message: `Please correct the following: ${validationErrors.join(" ")}`,
    };
  }

  return {
    field: "form",
    message: apiError.message,
  };
}
