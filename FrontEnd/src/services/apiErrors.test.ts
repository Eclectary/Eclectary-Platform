import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { parseApiError } from './apiErrors';

function responseError(status: number, data: unknown) {
  return new AxiosError('Technical Axios message', undefined, undefined, undefined, {
    status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() },
  });
}

describe('parseApiError', () => {
  it.each([400, 401, 403, 404, 409, 422, 429])('reads Rails messages for HTTP %s', (status) => {
    expect(parseApiError(responseError(status, { errors: [' Please try later. ', 'Contact support.'] })))
      .toEqual({
        status,
        messages: ['Please try later.', 'Contact support.'],
        message: 'Please try later. Contact support.',
        isClientError: true,
      });
  });

  it.each(['error', 'message'])('supports the legacy %s response', (key) => {
    expect(parseApiError(responseError(422, { [key]: 'Title cannot be blank.' })).message)
      .toBe('Title cannot be blank.');
  });

  it('prefers the Rails errors array over legacy fields', () => {
    expect(parseApiError(responseError(422, {
      errors: ['Current message.'], error: 'Old message.', message: 'Another message.',
    })).message).toBe('Current message.');
  });

  it('ignores malformed entries and falls back when no display message remains', () => {
    expect(parseApiError(responseError(422, {
      errors: [null, {}, 1, '', '  ', 'Title cannot be blank.'],
    })).messages).toEqual(['Title cannot be blank.']);

    for (const data of [null, 'HTML error page', [], { errors: {} }, { errors: [] }]) {
      const result = parseApiError(responseError(422, data));
      expect(result.messages).toEqual([]);
      expect(result.message).toBe('Please check your information and try again.');
    }
  });

  it.each([400, 401, 403, 404, 409, 422, 429])('has a safe default for HTTP %s', (status) => {
    const result = parseApiError(responseError(status, {}));
    expect(result.isClientError).toBe(true);
    expect(result.message).toBeTruthy();
    expect(result.message).not.toContain('Technical Axios message');
  });

  it.each([
    'ActiveRecord::RecordInvalid: internal details',
    'PG::UndefinedColumn: secret table',
    'TypeError: internal details',
    'Internal server error',
    'SELECT password_digest FROM users',
    '/app/controllers/users_controller.rb:42',
    'Traceback\nsecret',
    '<html>Exception details</html>',
    'x'.repeat(501),
  ])('does not expose technical details: %s', (message) => {
    const result = parseApiError(responseError(422, { errors: [message] }));
    expect(result.messages).toEqual([]);
    expect(result.message).toBe('Please check your information and try again.');
  });

  it.each([500, 502, 503])('ignores server response details for HTTP %s', (status) => {
    const result = parseApiError(responseError(status, { errors: ['Private server details'] }), 'Safe fallback.');
    expect(result).toEqual({
      status, messages: [], message: 'Safe fallback.', isClientError: false,
    });
  });

  it.each([undefined, null, new Error('Private error'), new AxiosError('Network Error')])(
    'uses the caller fallback for network and unexpected failures',
    (error) => {
      expect(parseApiError(error, 'Safe fallback.')).toEqual({
        status: undefined, messages: [], message: 'Safe fallback.', isClientError: false,
      });
    },
  );
});
