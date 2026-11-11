import { describe, expect, it } from 'vitest';

import {
  AuthSessionValidationError,
  normalizeLoginError,
  normalizeRegistrationError,
} from './authErrors';

function responseError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

describe('authentication error parsing', () => {
  it.each([
    { errors: ['Invalid email or password'] },
    { error: 'Invalid email or password' },
    { message: 'Invalid email or password' },
  ])('recognizes invalid credentials in supported response formats', (body) => {
    expect(normalizeLoginError(responseError(401, body))).toEqual({
      field: 'email', message: 'Invalid email or password.',
    });
  });

  it('preserves duplicate email and registration validation messages', () => {
    expect(normalizeRegistrationError(responseError(422, { errors: ['Email has already been taken'] })))
      .toEqual({ field: 'email', message: 'An account with this email already exists.' });
    expect(normalizeRegistrationError(responseError(422, { message: 'Password is too short' })))
      .toEqual({ field: 'form', message: 'Please correct the following: Password is too short' });
  });

  it.each([normalizeLoginError, normalizeRegistrationError])('shows throttling without exposing server failures', (normalize) => {
    expect(normalize(responseError(429, { errors: ['Too many requests. Please try again later.'] })).message)
      .toBe('Too many requests. Please try again later.');
    expect(normalize(responseError(500, { errors: ['Private details'] })).message).not.toContain('Private details');
    expect(normalize(new Error('Network failed')).message).toMatch(/right now/);
  });

  it('preserves the distinct session-validation messages', () => {
    const error = new AuthSessionValidationError();
    expect(normalizeLoginError(error).message).toMatch(/verify your session/);
    expect(normalizeRegistrationError(error).message).toMatch(/account was created/);
  });
});
