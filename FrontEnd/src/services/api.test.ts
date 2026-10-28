import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { AUTH_SESSION_UNAUTHORIZED_EVENT } from './authSession';

const originalAdapter = api.defaults.adapter;
const testAdapter: AxiosAdapter = async (config) => ({
  config,
  data: {},
  headers: new AxiosHeaders(),
  status: 200,
  statusText: 'OK',
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  api.defaults.adapter = testAdapter;
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

describe('API authorization token lookup', () => {
  it('uses a JWT from localStorage', async () => {
    window.localStorage.setItem('token', 'remembered-token');

    const response = await api.get('/authorization-test');

    expect(response.config.headers.Authorization).toBe('Bearer remembered-token');
  });

  it('uses a JWT from sessionStorage', async () => {
    window.sessionStorage.setItem('token', 'session-token');

    const response = await api.get('/authorization-test');

    expect(response.config.headers.Authorization).toBe('Bearer session-token');
  });
});

describe('unauthorized authenticated sessions', () => {
  function useUnauthorizedAdapter() {
    let rejectedError: AxiosError | undefined;

    api.defaults.adapter = async (config) => {
      const response = {
        config,
        data: { error: 'Unauthorized' },
        headers: new AxiosHeaders(),
        status: 401,
        statusText: 'Unauthorized',
      };

      rejectedError = new AxiosError(
        'Request failed with status code 401',
        AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
      );
      throw rejectedError;
    };

    return () => rejectedError;
  }

  it.each([
    ['localStorage', window.localStorage],
    ['sessionStorage', window.sessionStorage],
  ])('clears a JWT from both stores and notifies for a 401 using %s', async (_, storage) => {
    storage.setItem('token', 'expired-token');
    const notification = vi.fn();
    window.addEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
    const getRejectedError = useUnauthorizedAdapter();

    const receivedError = await api.get('/protected-resource').catch((error) => error);

    expect(receivedError).toBe(getRejectedError());
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(notification).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
  });

  it('does not notify when the failed request had no JWT', async () => {
    const notification = vi.fn();
    window.addEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
    useUnauthorizedAdapter();

    await expect(api.get('/protected-resource')).rejects.toBeInstanceOf(AxiosError);

    expect(notification).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
  });

  it('leaves an invalid login 401 to the login flow', async () => {
    window.localStorage.setItem('token', 'existing-token');
    const notification = vi.fn();
    window.addEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
    const getRejectedError = useUnauthorizedAdapter();

    const receivedError = await api.post('/login', {
      email: 'member@example.com',
      password: 'incorrect',
    }).catch((error) => error);

    expect(receivedError).toBe(getRejectedError());
    expect(window.localStorage.getItem('token')).toBe('existing-token');
    expect(notification).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
  });

  it('leaves successful authenticated responses and stored JWTs unchanged', async () => {
    window.sessionStorage.setItem('token', 'valid-token');
    const notification = vi.fn();
    window.addEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);

    const response = await api.get('/protected-resource');

    expect(response.status).toBe(200);
    expect(window.sessionStorage.getItem('token')).toBe('valid-token');
    expect(notification).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
  });
});
