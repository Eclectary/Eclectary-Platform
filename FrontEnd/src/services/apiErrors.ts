import { isAxiosError } from 'axios';

export interface ApiDisplayError {
  status: number | undefined;
  messages: string[];
  message: string;
  isClientError: boolean;
}

const CLIENT_MESSAGES: Record<number, string> = {
  400: 'Please check your request and try again.',
  401: 'Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item could not be found.',
  409: 'This request conflicts with the current state. Please review and try again.',
  422: 'Please check your information and try again.',
  429: 'Too many requests. Please wait before trying again.',
};

function isDisplayMessage(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= 500
    && !/[\r\n]|<[^>]*>|\b(?:ActiveRecord|ActionController|ActionDispatch|SQLSTATE|PG::|stack trace|backtrace|Traceback|internal server error|[A-Za-z]+Error|[A-Za-z]+Exception)\b/i.test(value)
    && !/(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\s+.+\s+(?:FROM|SET|VALUES|WHERE)\b|\/(?:app|home|var|usr)\/|\.(?:rb|tsx?|jsx?):\d+/i.test(value);
}

export function parseApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): ApiDisplayError {
  const response = isAxiosError<unknown>(error) ? error.response : undefined;
  const status = response?.status;
  const defaultMessage = status !== undefined && Object.hasOwn(CLIENT_MESSAGES, status)
    ? CLIENT_MESSAGES[status]
    : undefined;
  const isClientError = defaultMessage !== undefined;
  const data = response?.data;
  let messages: string[] = [];

  if (isClientError && data && typeof data === 'object') {
    const body = data as { errors?: unknown; error?: unknown; message?: unknown };
    messages = (Array.isArray(body.errors) ? body.errors : [])
      .filter(isDisplayMessage).map((message) => message.trim());
    if (messages.length === 0) {
      const legacyMessage = [body.error, body.message].find(isDisplayMessage);
      if (legacyMessage) messages = [legacyMessage.trim()];
    }
  }

  return {
    status,
    messages,
    message: messages.join(' ') || defaultMessage || fallback,
    isClientError,
  };
}
