import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';
import { AUTH_SESSION_UNAUTHORIZED_EVENT } from './authSession';
import {
  addCartItem,
  clearCart,
  getCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItem,
} from './cartApi';

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

  it('preserves an explicit request token when the stored session changes before dispatch', async () => {
    window.localStorage.setItem('token', 'previous-token');
    const request = api.get('/cart', {
      headers: { Authorization: 'Bearer previous-token' },
    });
    window.localStorage.setItem('token', 'new-session-token');

    const response = await request;

    expect(response.config.headers.Authorization).toBe('Bearer previous-token');
  });

  it('binds every cart operation to its initiating token before interceptor dispatch', async () => {
    const authorizations: string[] = [];
    api.defaults.adapter = async (config) => {
      authorizations.push(String(config.headers.Authorization));
      return {
        config,
        data: {
          data: { id: 1, items: [] },
          merge: { added_items: [], skipped_items: [], merge_identifier: 'transfer', repeated: false },
        },
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      };
    };
    window.localStorage.setItem('token', 'previous-token');
    const requests = [
      getCart('previous-token'),
      mergeGuestCart({ merge_identifier: 'transfer', items: [] }, 'previous-token'),
      addCartItem({ product_id: 1, quantity: 1 }, 'previous-token'),
      updateCartItem(1, { quantity: 2 }, 'previous-token'),
      removeCartItem(1, 'previous-token'),
      clearCart('previous-token'),
    ];
    window.localStorage.setItem('token', 'new-session-token');

    await Promise.all(requests);

    expect(authorizations).toEqual(Array(6).fill('Bearer previous-token'));
  });
});

describe('unauthorized authenticated sessions', () => {
  function useUnauthorizedAdapter(beforeReject?: () => void) {
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
      beforeReject?.();
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

  it('does not clear a newer session for an old token response', async () => {
    window.localStorage.setItem('token', 'previous-token');
    const notification = vi.fn();
    window.addEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
    const getRejectedError = useUnauthorizedAdapter(() => {
      window.localStorage.setItem('token', 'new-session-token');
    });

    const receivedError = await api.get('/cart').catch((error) => error);

    expect(receivedError).toBe(getRejectedError());
    expect(window.localStorage.getItem('token')).toBe('new-session-token');
    expect(notification).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
  });

  it('does not clear a newer session when an explicitly bound old request fails', async () => {
    window.localStorage.setItem('token', 'previous-token');
    const notification = vi.fn();
    window.addEventListener(AUTH_SESSION_UNAUTHORIZED_EVENT, notification);
    useUnauthorizedAdapter();
    const request = api.get('/cart', {
      headers: { Authorization: 'Bearer previous-token' },
    });
    window.localStorage.setItem('token', 'new-session-token');

    await expect(request).rejects.toBeInstanceOf(AxiosError);

    expect(window.localStorage.getItem('token')).toBe('new-session-token');
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
