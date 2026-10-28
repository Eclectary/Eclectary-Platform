import axios from "axios";

type AuthErrorField = "email" | "form";

export interface AuthDisplayError {
  field: AuthErrorField;
  message: string;
}

interface RailsAuthErrorResponse {
  error?: unknown;
  errors?: unknown;
}

export class AuthSessionValidationError extends Error {
  constructor(cause?: unknown) {
    super("Authentication session validation failed", { cause });
    this.name = "AuthSessionValidationError";
  }
}

function getRailsError(error: unknown) {
  if (!axios.isAxiosError<RailsAuthErrorResponse>(error)) {
    return null;
  }

  return {
    status: error.response?.status,
    data: error.response?.data,
  };
}

export function normalizeLoginError(error: unknown): AuthDisplayError {
  if (error instanceof AuthSessionValidationError) {
    return {
      field: "form",
      message: "We couldn't verify your session. Please sign in again.",
    };
  }

  const railsError = getRailsError(error);
  if (
    railsError?.status === 401
    && railsError.data?.error === "Invalid email or password"
  ) {
    return {
      field: "email",
      message: "Invalid email or password.",
    };
  }

  return {
    field: "form",
    message: "Unable to sign in right now. Please try again.",
  };
}

export function normalizeRegistrationError(error: unknown): AuthDisplayError {
  if (error instanceof AuthSessionValidationError) {
    return {
      field: "form",
      message: "Your account was created, but we couldn't sign you in. Please sign in.",
    };
  }

  const railsError = getRailsError(error);
  const validationErrors = railsError?.status === 422 && Array.isArray(railsError.data?.errors)
    ? railsError.data.errors.filter(
        (message): message is string => typeof message === "string" && message.trim().length > 0,
      )
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
    message: "Unable to create your account right now. Please try again.",
  };
}
